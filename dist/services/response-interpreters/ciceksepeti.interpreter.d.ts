import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * Çiçeksepeti API response interpreter
 *
 * Çiçeksepeti API'sinin response yapıları:
 *   - Order/GetOrders → { orderListCount, supplierOrderListWithBranch: [...] }
 *   - Order/getcanceledorders → { orderItemList: [...] }
 *   - Order/cancelevaluation → { isSuccess, message }
 *   - Order/refundprocessstartreceivedprocess → { orderItems: [...] }
 *   - Products POST/PUT/price-and-stock → { batchId } (async)
 *   - Products/batch-status/{batchId} → { batchId, itemCount, items: [{status: "Pending|Processing|Success|Failed|Warning"}] }
 *   - Products GET → { totalCount, products: [...] }
 *   - Categories GET → { categories: [...] (tree) }
 *   - Categories/{id}/attributes → { categoryAttributes: [...] }
 *   - sellerquestions GET → { items: [...], hasNextPage }
 */
export declare class CicekSepetiResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Batch submit yanıtını yorumla — POST /Products, PUT /Products, PUT /Products/price-and-stock
     * Response: { batchId: "uuid-..." }
     */
    private interpretBatchSubmit;
    /**
     * Batch status yanıtını yorumla
     * Response: { batchId, itemCount, items: [{itemId, status: "Pending|Processing|Success|Failed|Warning", failureReasons}] }
     */
    private interpretBatchStatus;
    /**
     * Ürün listeleme yanıtını yorumla
     * Response: { totalCount, products: [...] }
     */
    private interpretProductList;
    /**
     * Sipariş veya iade listeleme yanıtını yorumla
     * Order/GetOrders → { orderListCount, supplierOrderListWithBranch: [...] }
     * Order/getcanceledorders → { orderItemList: [...] }
     */
    private interpretOrderOrRefundList;
    /**
     * Sipariş güncelleme yanıtını yorumla
     * Order/cancelevaluation → { isSuccess, message }
     * Order/refundprocessstartreceivedprocess → { orderItems: [{orderItemId, isSuccess, validation}] }
     */
    private interpretOrderUpdate;
    /**
     * Kategori listesi yanıtını yorumla (tree yapısı)
     * Response: { categories: [{id, name, parentCategoryId, subCategories: [...]}] }
     */
    private interpretCategoryList;
    /**
     * Kategori öznitelik yanıtını yorumla
     * Response: { categoryId, categoryName, categoryAttributes: [...] }
     */
    private interpretCategoryAttributes;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
