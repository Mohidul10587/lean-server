import mongoose, { Schema, Document } from "mongoose";

interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  title: string;
  quantity: number;
  price: number;
}

interface IDeliveryAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface IPayment {
  method: string;
  senderNumber?: string;
  transactionId?: string;
}

interface IOrder extends Document {
  userId?: mongoose.Types.ObjectId;
  orderId: string;
  referrerId?: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryCharge: number;
  deliveryZone: "inside_dhaka" | "outside_dhaka";
  totalAmount: number;
  status: "processing" | "delivered" | "cancelled";
  deliveryAddress: IDeliveryAddress;
  payment: IPayment;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    orderId: { type: String, required: true, unique: true },
    referrerId: { type: String, default: undefined },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        title: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    deliveryCharge: { type: Number, required: true, default: 0 },
    deliveryZone: { type: String, enum: ["inside_dhaka", "outside_dhaka"], required: true },
    status: { type: String, enum: ["processing", "delivered", "cancelled"], default: "processing" },
    deliveryAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    payment: {
      method: { type: String, required: true },
      senderNumber: { type: String, default: "" },
      transactionId: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", orderSchema);
