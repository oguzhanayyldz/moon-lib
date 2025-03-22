import mongoose, { Document, Model, Query } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";
import { v4 as uuidv4 } from 'uuid';
import moment from "moment-timezone";
import { generateRandomString, SortType } from "@xmoonx/common";

export interface BaseAttrs {
  id?: string;
  _id?: string;
  uuid?: string;
  version?: number;
  creationDate?: Date;
  updatedOn?: Date;
  deletionDate?: Date;
  deleted?: boolean;
  uniqueCode?: string | null;
}

export interface BaseDoc extends Document {
  id: string;
  uuid: string;
  version: number;
  creationDate: Date;
  updatedOn: Date;
  deletionDate: Date;
  deleted: boolean;
  uniqueCode: string;
  destroy(): Promise<void>;
}

export interface BaseModel<T extends BaseDoc, A extends BaseAttrs> extends Model<T> {
  build(attrs: A, modelName: string): T;
  findByCustom(id: string, modelName: string): Promise<T | null>;
  filter(where: Partial<A>, modelName: string, limit?: number, offset?: number, order?: SortType): Promise<T[] | null>;
  destroyMany(where: Partial<A>, modelName: string): Promise<{ matchedCount: number, modifiedCount: number }>;
  findByEvent(event: { id: string, version: number }, modelName: string): Promise<T | null>;
}

const BaseSchema = new mongoose.Schema({
  uuid: {
    type: String,
  },
  creationDate: {
    type: Date,
    default: Date.now,
    required: true,
    timezone: 'Europe/Istanbul',
    get: (val: any) => moment(val).tz('Europe/Istanbul').format()
  },
  updatedOn: {
    type: Date,
    default: Date.now,
    required: true,
    timezone: 'Europe/Istanbul',
    get: (val: any) => moment(val).tz('Europe/Istanbul').format()
  },
  deletionDate: {
    type: Date,
    timezone: 'Europe/Istanbul',
    get: (val: any) => val ? moment(val).tz('Europe/Istanbul').format(): undefined
  },
  deleted: {
      type: Boolean,
  },
  uniqueCode: {
      type: String,
      unique: true
  }
}, {
  toJSON: {
      transform(doc, ret) {
          ret.id = ret._id;
          delete ret._id;
          delete ret.__v;
      }
  }
});

BaseSchema.set('versionKey', 'version');
BaseSchema.plugin(updateIfCurrentPlugin);

BaseSchema.set('toJSON', { getters: true });
BaseSchema.set('toObject', { getters: true });

BaseSchema.statics.build = <T extends BaseDoc, A extends BaseAttrs>(attrs: A, modelName: string): T => {
  const Model = mongoose.model<T, any>(modelName);
  if (attrs && attrs.id){
    attrs._id = attrs.id;
    delete attrs.id;
  }
  return new Model(attrs);
};

BaseSchema.statics.findByCustom = <T extends BaseDoc>(id: string, modelName: string) : Promise<T | null> => {
  const Model = mongoose.model<T, any>(modelName);
  return Model.findById(id)
      .where({ deletionDate: { $exists: false }, deleted: { $exists: false } })
      .exec();
};

BaseSchema.statics.findByEvent = <T extends BaseDoc>(event: { id: string, version: number }, modelName: string): Promise<T | null> => {
  const Model = mongoose.model<T, any>(modelName);
  return Model.findOne({
      _id: event.id,
      version: event.version - 1,
      deletionDate: { $exists: false }, 
      deleted: { $exists: false }
  });
};

BaseSchema.statics.filter = <T extends BaseDoc, A extends BaseAttrs>(
  where: Partial<A>,
  modelName: string,
  limit?: number,
  offset?: number,
  order?: SortType,
): Promise<T[]> => {
  const Model = mongoose.model<T, any>(modelName);
  limit = limit || 20;
  offset = offset || 0;
  const query = Model.find()
      .where(where)
      .sort(order)
      .skip(offset)
      .limit(limit);

  return query.exec();
};

BaseSchema.statics.destroyMany = async function <T extends BaseDoc, A extends BaseAttrs>(where: Partial<A>, modelName: string): Promise<{ matchedCount: number, modifiedCount: number }> {
  const Model = mongoose.model<T, any>(modelName);
  const updateResult = await Model.updateMany(where, {
      $set: {
          deletionDate: new Date(),
          uniqueCode: new Date().getTime().toString() + "-" + generateRandomString(4),
          deleted: true
      }
  });

  return {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount
  };
};

BaseSchema.pre<BaseDoc>("save", async function (next) {
  if (!this.uuid) {
    this.uuid = uuidv4();
  }
  if (!this.deleted && !this.deletionDate && !this.uniqueCode) this.uniqueCode =  new Date().getTime().toString() + "-" + generateRandomString(6);
  this.updatedOn = new Date();
  next();
});

BaseSchema.pre<BaseDoc>('findOneAndUpdate', function(next) {
  const filter = (this as any).getQuery();
  this.updateOne(filter, { $set: { updatedOn: new Date() } });
  next();
});

BaseSchema.pre<BaseDoc>('updateOne', function(next) {
  const filter = (this as any).getQuery();
  this.updateOne(filter, { $set: { updatedOn: new Date() } });
  next();
});

BaseSchema.pre<BaseDoc>('find', function(next) {
  const query = (this as any) as Query<BaseDoc[], BaseDoc>;
  const queryConditions = query.getQuery();
  const includeDeleted = queryConditions.includeDeleted;
  delete queryConditions.includeDeleted;

  if (!includeDeleted) {
    query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
  }
  next();
});

BaseSchema.pre<BaseDoc>('findOne', function(next) {
  const query = (this as any) as Query<BaseDoc, BaseDoc>;
  const queryConditions = query.getQuery();
  const includeDeleted = queryConditions.includeDeleted;
  delete queryConditions.includeDeleted;

  if (!includeDeleted) {
    query.where({ deletionDate: { $exists: false }, deleted: { $exists: false } });
  }
  next();
});

BaseSchema.methods.destroy = async function (): Promise<void> {
  try {
      const instance = this as BaseDoc;
      if (!instance.deletionDate) {
          instance.deletionDate = new Date();
      }
      instance.uniqueCode = new Date().getTime().toString() + "-" + generateRandomString(6);
      instance.deleted = true;
      await instance.save();
  } catch (err) {
      console.error(err);
  }
};

export default BaseSchema;