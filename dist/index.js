"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const errorHandler_1 = require("./middleware/errorHandler");
const seedAdmin_1 = require("./utils/seedAdmin");
const seedSettings_1 = require("./utils/seedSettings");
// ImportRoutes
const routes_1 = __importDefault(require("./app/submission/routes"));
const routes_2 = __importDefault(require("./app/transaction/routes"));
const routes_3 = __importDefault(require("./app/withdraw/routes"));
const routes_4 = __importDefault(require("./app/wallet/routes"));
const routes_5 = __importDefault(require("./app/user/routes"));
const routes_6 = __importDefault(require("./app/settings/routes"));
const routes_7 = __importDefault(require("./app/stats/routes"));
const routes_8 = __importDefault(require("./app/report/routes"));
const routes_9 = __importDefault(require("./app/product/routes"));
const routes_10 = __importDefault(require("./app/cart/routes"));
const routes_11 = __importDefault(require("./app/order/routes"));
const route_1 = __importDefault(require("./app/upload-video/route"));
const routes_12 = __importDefault(require("./app/upload-image/routes"));
// Super Admin Routes
const super_admin_routes_1 = __importDefault(require("./app/user/super-admin-routes"));
const super_admin_routes_2 = __importDefault(require("./app/product/super-admin-routes"));
const super_admin_routes_3 = __importDefault(require("./app/report/super-admin-routes"));
const super_admin_routes_4 = __importDefault(require("./app/order/super-admin-routes"));
const super_admin_routes_5 = __importDefault(require("./app/withdraw/super-admin-routes"));
const super_admin_routes_6 = __importDefault(require("./app/wallet/super-admin-routes"));
const super_admin_routes_7 = __importDefault(require("./app/stats/super-admin-routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
mongoose_1.default.connect(mongoUri);
const db = mongoose_1.default.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Connected to MongoDB");
    yield (0, seedAdmin_1.seedAdmin)();
    yield (0, seedSettings_1.seedSettings)();
    // startSalaryCron();
}));
// Middleware
app.use(body_parser_1.default.json()); // Parse JSON bodies
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3000",
        "https://learnefymart.com",
        "https://www.learnefymart.com",
        "https://course-seven-coral.vercel.app",
        "https://hsonlinebde-learningplatfrom.com",
        "https://www.hsonlinebde-learningplatfrom.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
}));
// Main Route
app.get("/", (req, res) => {
    res.send("Welcome to the Price in Kenya Sever!"); // Send a welcome message
});
// UseRoutes
app.use("/submission", routes_1.default);
app.use("/transaction", routes_2.default);
app.use("/withdraw", routes_3.default);
app.use("/wallet", routes_4.default);
app.use("/user", routes_5.default);
app.use("/settings", routes_6.default);
app.use("/stats", routes_7.default);
app.use("/report", routes_8.default);
app.use("/product", routes_9.default);
app.use("/cart", routes_10.default);
app.use("/order", routes_11.default);
app.use("/upload-video", route_1.default);
app.use("/upload-image", routes_12.default);
// Super Admin Routes
app.use("/super-admin/user", super_admin_routes_1.default);
app.use("/super-admin/product", super_admin_routes_2.default);
app.use("/super-admin/report", super_admin_routes_3.default);
app.use("/super-admin/order", super_admin_routes_4.default);
app.use("/super-admin/withdraw", super_admin_routes_5.default);
app.use("/super-admin/wallet", super_admin_routes_6.default);
app.use("/super-admin/stats", super_admin_routes_7.default);
app.use(errorHandler_1.errorHandler);
app.listen(port, () => {
    console.log(port);
});
