import { Request, Response } from "express";
import { Order } from "./model";
import { Wallet } from "../wallet/model";
import { Transaction } from "../transaction/model";
import { Product } from "../product/model";
import { User } from "../user/model";
import { Settings } from "../settings/model";
import { deductWalletBalance } from "../../utils/deductWalletBalance";
import mongoose from "mongoose";

export const createOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { deliveryAddress, deliveryZone, items: cartItems, payment } = req.body;

    // collect referrerId — take from first item that has one (one referrer per order)
    const referrerId = cartItems?.find((i: any) => i.referrerId)?.referrerId || undefined;

    if (!deliveryZone || !["inside_dhaka", "outside_dhaka"].includes(deliveryZone)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Delivery zone is required" });
    }

    if (!deliveryAddress?.fullName || !deliveryAddress?.phone || !deliveryAddress?.address ||
        !deliveryAddress?.city || !deliveryAddress?.postalCode || !deliveryAddress?.country) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Delivery address is required" });
    }

    if (!payment?.method || (payment.method !== "cash_on_delivery" && payment.method !== "wallet_balance" && (!payment?.senderNumber || !payment?.transactionId))) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Payment details are required" });
    }

    if (!cartItems?.length) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Cart is empty" });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of cartItems) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ message: "Product not found" });
      }
      const price = product.salePrice;
      subtotal += price * item.quantity;
      orderItems.push({
        productId: product._id,
        title: product.title.en,
        quantity: item.quantity,
        price,
      });
    }

    const settings = await Settings.findOne();
    const deliveryCharge = deliveryZone === "inside_dhaka"
      ? settings?.deliveryChargeInsideDhaka ?? 0
      : settings?.deliveryChargeOutsideDhaka ?? 0;
    const totalAmount = subtotal + deliveryCharge;

    const orderId = `ORD${Date.now()}`;
    const userId = req.body.userId ? new mongoose.Types.ObjectId(req.body.userId) : req.user?._id;

    const order = new Order({
      userId,
      orderId,
      items: orderItems,
      referrerId: referrerId || undefined,
      subtotal,
      deliveryCharge,
      deliveryZone,
      totalAmount,
      status: "processing",
      deliveryAddress,
      payment,
    });
    await order.save({ session });

    // Deduct wallet only when payment method is wallet_balance
    if (userId && payment.method === "wallet_balance") {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ message: "Wallet not found" });
      }
      const { previousTotal, currentTotal } = await deductWalletBalance(wallet, totalAmount, session);
      await Transaction.create([{
        userId,
        previousAmount: previousTotal,
        recentAmount: -totalAmount,
        currentTotal,
        description: `Order purchase - ${orderId}`,
        type: "debit",
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();
    res.json({ message: "Order placed successfully", order });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating order:", error);
    const isKnown = error?.message === "Insufficient balance";
    res.status(isKnown ? 400 : 500).json({ message: error?.message || "Error creating order" });
  }
};
export const createDirectOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, deliveryAddress, deliveryZone, referrerId, payment } = req.body;
    if (!deliveryZone || !["inside_dhaka", "outside_dhaka"].includes(deliveryZone)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Delivery zone is required" });
    }

    if (!deliveryAddress?.fullName || !deliveryAddress?.phone || !deliveryAddress?.address ||
        !deliveryAddress?.city || !deliveryAddress?.postalCode || !deliveryAddress?.country) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Delivery address is required" });
    }

    if (!payment?.method || (payment.method !== "cash_on_delivery" && payment.method !== "wallet_balance" && (!payment?.senderNumber || !payment?.transactionId))) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Payment details are required" });
    }

    if (!productId || !quantity || quantity < 1) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Invalid product or quantity" });
    }

    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ message: "Product not found" });
    }

    const price = product.salePrice;
    const subtotal = price * quantity;
    const settings = await Settings.findOne();
    const deliveryCharge = deliveryZone === "inside_dhaka"
      ? settings?.deliveryChargeInsideDhaka ?? 0
      : settings?.deliveryChargeOutsideDhaka ?? 0;
    const totalAmount = subtotal + deliveryCharge;
    const orderId = `ORD${Date.now()}`;
    const userId = req.body.userId ? new mongoose.Types.ObjectId(req.body.userId) : req.user?._id;

    const order = new Order({
      userId,
      orderId,
      items: [{ productId: product._id, title: product.title.en, quantity, price }],
      referrerId: referrerId || undefined,
      subtotal,
      deliveryCharge,
      deliveryZone,
      totalAmount,
      status: "processing",
      deliveryAddress,
      payment,
    });
    await order.save({ session });

    // Deduct wallet only when payment method is wallet_balance
    if (userId && payment.method === "wallet_balance") {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        await session.abortTransaction(); session.endSession();
        return res.status(400).json({ message: "Wallet not found" });
      }
      const { previousTotal, currentTotal } = await deductWalletBalance(wallet, totalAmount, session);
      await Transaction.create([{
        userId,
        previousAmount: previousTotal,
        recentAmount: -totalAmount,
        currentTotal,
        description: `Order purchase - ${orderId}`,
        type: "debit",
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();
    res.json({ message: "Order placed successfully", order });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating direct order:", error);
    const isKnown = error?.message === "Insufficient balance";
    res.status(isKnown ? 400 : 500).json({ message: error?.message || "Error creating order" });
  }
};
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user?._id }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders" });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.aggregate([
      { $sort: { createdAt: -1 } },

      // Populate buyer
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, username: 1, userId: 1 } }],
          as: "userId",
        },
      },
      { $set: { userId: { $arrayElemAt: ["$userId", 0] } } },

      // Populate referrer by referrerId string -> user.userId
      {
        $lookup: {
          from: "users",
          localField: "referrerId",
          foreignField: "userId",
          pipeline: [{ $project: { name: 1, userId: 1, image: 1 } }],
          as: "referrer",
        },
      },
      { $set: { referrer: { $arrayElemAt: ["$referrer", 0] } } },
    ]);

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders" });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    const previousStatus = order.status;
    if (previousStatus === status) {
      await session.abortTransaction();
      session.endSession();
      return res.json({ message: "Order status unchanged", order });
    }

    order.status = status;
    await order.save({ session });

    // Refund only if paid via wallet_balance and newly cancelled
    if (status === "cancelled" && previousStatus !== "cancelled" && order.payment?.method === "wallet_balance") {
      const wallet = await Wallet.findOne({ userId: order.userId }).session(session);
      if (wallet) {
        const previousBalance = wallet.earnedBalance;
        wallet.earnedBalance += order.totalAmount;
        await wallet.save({ session });
        await Transaction.create([{
          userId: order.userId,
          previousAmount: previousBalance,
          recentAmount: order.totalAmount,
          currentTotal: wallet.earnedBalance,
          description: `Order Refund - ${order.orderId}`,
          type: "credit",
        }], { session });
      }
    }

    // Pay affiliate commission — only when newly delivered
    if (status === "delivered" && previousStatus !== "delivered" && order.referrerId) {
      const referrer = await User.findOne({ userId: order.referrerId }).session(session);

      if (referrer?.isActive) {
        // Fetch all products in one query
        const productIds = order.items.map((i) => i.productId);
        const products = await Product.find({ _id: { $in: productIds }, isAffiliate: true, affCommAmount: { $gt: 0 } })
          .select("_id affCommAmount")
          .session(session);

        const productMap = new Map(products.map((p) => [p._id.toString(), p.affCommAmount]));

        const totalCommission = order.items.reduce((sum, item) => {
          const commAmount = productMap.get(item.productId.toString());
          return commAmount ? sum + commAmount * item.quantity : sum;
        }, 0);

        if (totalCommission > 0) {
          const referrerWallet = await Wallet.findOne({ userId: referrer._id }).session(session);
          if (referrerWallet) {
            const previousBalance = referrerWallet.earnedBalance;
            referrerWallet.earnedBalance += totalCommission;
            await referrerWallet.save({ session });
            await Transaction.create([{
              userId: referrer._id,
              previousAmount: previousBalance,
              recentAmount: totalCommission,
              currentTotal: referrerWallet.earnedBalance,
              description: `Affiliate commission - Order ${order.orderId}`,
              type: "credit",
            }], { session });
          }
        }
      }
    }

    await session.commitTransaction();
    session.endSession();
    res.json({ message: "Order status updated", order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Error updating order status" });
  }
};
