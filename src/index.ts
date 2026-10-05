import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import { seedAdmin } from "./utils/seedAdmin";
import { seedSettings } from "./utils/seedSettings";
import { startSalaryCron } from "./services/salaryCron";
// ImportRoutes
import submissionRoutes from "./app/submission/routes";
import transactionRoutes from "./app/transaction/routes";
import withdrawRoutes from "./app/withdraw/routes";
import walletRoutes from "./app/wallet/routes";
import userRoutes from "./app/user/routes";
import settingsRoutes from "./app/settings/routes";
import statsRoutes from "./app/stats/routes";
import reportRoutes from "./app/report/routes";
import productRoutes from "./app/product/routes";
import cartRoutes from "./app/cart/routes";
import orderRoutes from "./app/order/routes";
import uploadVideoRoutes from "./app/upload-video/route";
import uploadImageRoutes from "./app/upload-image/routes";

// Super Admin Routes
import userSuperAdminRoutes from "./app/user/super-admin-routes";
import productSuperAdminRoutes from "./app/product/super-admin-routes";
import reportSuperAdminRoutes from "./app/report/super-admin-routes";
import orderSuperAdminRoutes from "./app/order/super-admin-routes";
import withdrawSuperAdminRoutes from "./app/withdraw/super-admin-routes";
import walletSuperAdminRoutes from "./app/wallet/super-admin-routes";
import statsSuperAdminRoutes from "./app/stats/super-admin-routes";

dotenv.config();

// Fix #8 / #14: validate required env vars at startup — fail fast
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app: Express = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI as string;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:3000", "https://learn77.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Main Route
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Server!");
});

// UseRoutes
app.use("/submission", submissionRoutes);
app.use("/transaction", transactionRoutes);
app.use("/withdraw", withdrawRoutes);
app.use("/wallet", walletRoutes);
app.use("/user", userRoutes);
app.use("/settings", settingsRoutes);
app.use("/stats", statsRoutes);
app.use("/report", reportRoutes);
app.use("/product", productRoutes);
app.use("/cart", cartRoutes);
app.use("/order", orderRoutes);
app.use("/upload-video", uploadVideoRoutes);
app.use("/upload-image", uploadImageRoutes);

// Super Admin Routes
app.use("/super-admin/user", userSuperAdminRoutes);
app.use("/super-admin/product", productSuperAdminRoutes);
app.use("/super-admin/report", reportSuperAdminRoutes);
app.use("/super-admin/order", orderSuperAdminRoutes);
app.use("/super-admin/withdraw", withdrawSuperAdminRoutes);
app.use("/super-admin/wallet", walletSuperAdminRoutes);
app.use("/super-admin/stats", statsSuperAdminRoutes);

app.use(errorHandler);

// Fix #14: await MongoDB connection before starting to accept requests
// Runtime errors after connection are logged but don't crash the process.
mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err);
});

async function startServer() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
    await seedAdmin();
    await seedSettings();
    // startSalaryCron(); // uncomment when ready

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed — server will not start:", err);
    process.exit(1);
  }
}

startServer();
