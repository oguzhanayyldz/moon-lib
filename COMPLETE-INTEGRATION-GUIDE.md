# 🚀 Complete Moon-lib Common Utilities - Service Integration Examples

## 📦 **All Available Utilities**

Moon-lib now includes **ALL** essential utilities from moon-common:

### **🔥 Complete Error Handling:**
```typescript
import { 
  CustomError,
  BadRequestError,
  NotFoundError,
  NotAuthorizedError,
  DatabaseConnectionError,
  RequestValidationError
} from '@xmoonx/moon-lib';
```

### **🔒 Complete Authentication Middleware:**
```typescript
import { 
  currentUser,
  requireAuth,
  errorHandler
} from '@xmoonx/moon-lib';
```

### **📡 Complete Event System:**
```typescript
import { 
  Publisher,
  Listener,
  Event,
  Subjects
} from '@xmoonx/moon-lib';
```

### **🏗️ Core Integration Classes:**
```typescript
import { 
  BaseIntegration,
  UserRole
} from '@xmoonx/moon-lib';
```

## 🎯 **Real Service Implementation Examples**

### **Auth Service Integration:**
```typescript
// auth/src/routes/signin.ts
import { 
  BadRequestError, 
  NotAuthorizedError,
  currentUser,
  requireAuth,
  errorHandler
} from '@xmoonx/moon-lib';

const router = express.Router();

router.post('/api/users/signin', 
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').trim().notEmpty().withMessage('Password is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      throw new BadRequestError('Invalid credentials');
    }

    const passwordsMatch = await Password.compare(existingUser.password, password);
    if (!passwordsMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    // Generate JWT and set session
    const userJwt = jwt.sign({
      id: existingUser.id,
      email: existingUser.email,
      role: existingUser.role
    }, process.env.JWT_KEY!);

    req.session = { jwt: userJwt };

    res.status(200).send(existingUser);
  }
);

// Apply middlewares
app.use(currentUser);
app.use(errorHandler);
```

### **Orders Service Integration:**
```typescript
// orders/src/routes/new.ts
import { 
  requireAuth,
  NotFoundError,
  BadRequestError,
  Publisher,
  Subjects
} from '@xmoonx/moon-lib';

router.post('/api/orders', 
  requireAuth,
  [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be greater than 0')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { productId, quantity } = req.body;

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError();
    }

    // Check stock
    if (product.stock < quantity) {
      throw new BadRequestError('Insufficient stock');
    }

    // Create order
    const order = Order.build({
      userId: req.currentUser!.id,
      productId: product.id,
      quantity,
      price: product.price * quantity,
      status: OrderStatus.Created
    });

    await order.save();

    // Publish order created event
    new OrderCreatedPublisher(natsWrapper.client).publish({
      id: order.id,
      userId: order.userId,
      productId: order.productId,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      version: order.version
    });

    res.status(201).send(order);
  }
);
```

### **Integration Service Example:**
```typescript
// integrations/ecommerce/shopify/src/services/shopify-integration.ts
import { BaseIntegration } from '@xmoonx/moon-lib';

export class ShopifyIntegration extends BaseIntegration {
  protected type = 'ecommerce';
  protected platform = 'shopify';

  protected getDefaultCredentials() {
    return {
      api_key: '',
      api_secret: '',
      access_token: '',
      shop_domain: '',
      integration_active: false,
      user: '',
      platform: 'shopify'
    };
  }

  protected validatePlatformCredentials(): void {
    const required = ['api_key', 'api_secret', 'access_token', 'shop_domain'];
    for (const field of required) {
      if (!this.credentials[field]) {
        throw new Error(`Shopify ${field} is required`);
      }
    }
  }

  protected async connect(): Promise<void> {
    // Test Shopify connection
    try {
      const response = await axios.get(
        `https://${this.credentials.shop_domain}.myshopify.com/admin/api/2023-04/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': this.credentials.access_token
          }
        }
      );
      
      if (response.status !== 200) {
        throw new Error('Failed to connect to Shopify');
      }
    } catch (error) {
      throw new Error(`Shopify connection failed: ${error.message}`);
    }
  }
}
```

### **Event Listener Example:**
```typescript
// inventory/src/events/listeners/order-created-listener.ts
import { 
  Listener, 
  OrderCreatedEvent, 
  Subjects 
} from '@xmoonx/moon-lib';
import { Message } from 'node-nats-streaming';

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
  subject = Subjects.OrderCreated;
  queueGroupName = 'inventory-service';

  async onMessage(data: OrderCreatedEvent['data'], msg: Message) {
    try {
      // Find the product and update stock
      const product = await Product.findById(data.productId);
      
      if (!product) {
        throw new Error('Product not found');
      }

      // Update stock
      product.stock -= data.quantity;
      await product.save();

      // Publish stock updated event
      await new StockUpdatedPublisher(this.client).publish({
        productId: product.id,
        newStock: product.stock,
        orderId: data.id,
        version: product.version
      });

      msg.ack();
    } catch (error) {
      console.error('Error processing order created event:', error);
      // Don't ack - message will be redelivered
    }
  }
}
```

### **Error Handling in Routes:**
```typescript
// products/src/routes/update.ts
import { 
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
  BadRequestError,
  RequestValidationError
} from '@xmoonx/moon-lib';

router.put('/api/products/:id',
  requireAuth,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be non-negative')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { title, description, price, stock } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new NotFoundError();
    }

    // Check ownership
    if (product.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }

    // Validate business rules
    if (price < 0) {
      throw new BadRequestError('Price cannot be negative');
    }

    // Update product
    product.set({
      title,
      description,
      price,
      stock
    });

    await product.save();

    // Publish product updated event
    new ProductUpdatedPublisher(natsWrapper.client).publish({
      id: product.id,
      title: product.title,
      price: product.price,
      stock: product.stock,
      userId: product.userId,
      version: product.version
    });

    res.send(product);
  }
);
```

## 🚀 **Migration Instructions**

### **Step-by-Step Service Migration:**

1. **Update imports:**
```typescript
// OLD
import { BadRequestError, requireAuth } from '@xmoonx/common';

// NEW
import { BadRequestError, requireAuth } from '@xmoonx/moon-lib';
```

2. **Remove old dependency:**
```bash
npm uninstall @xmoonx/common
```

3. **Ensure moon-lib peer dependency:**
```json
{
  "peerDependencies": {
    "@xmoonx/moon-lib": "^1.0.0"
  }
}
```

4. **Test functionality:**
```bash
npm run build  # Should compile without errors
npm test       # Run your tests
```

## 🎯 **Benefits Achieved**

### **For Development:**
- ✅ **Zero NPM complexity** - Direct submodule editing
- ✅ **Immediate availability** - No publish cycles
- ✅ **Single dependency** - All utilities in one place
- ✅ **Type safety** - Full TypeScript support

### **For GitHub Copilot Agent:**
- ✅ **Direct editing** of common utilities
- ✅ **Cross-service development** in single session
- ✅ **No publishing bottlenecks**
- ✅ **Enhanced productivity**

---

**Moon-lib now provides 100% feature parity with @xmoonx/common while eliminating all NPM publishing complexity!** 🎯
