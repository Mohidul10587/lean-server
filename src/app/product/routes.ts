import { Router } from "express";
import {
  allForAdminIndex,
  create,
  singleForEdit,
  update,
  forUserDetails,
  deleteById,
  getAllSlugs,
  getAffiliateProducts,
} from "./controller";
import { verifyAdmin, verifyUser } from "../../middleware/auth";
import { allForUserIndex, getProductTypes } from "./filter";

const router = Router();

//====================== For User ======================
router.get("/product-types", getProductTypes);
router.get("/shop", allForUserIndex);
router.get("/shop/slugs", getAllSlugs);
router.get("/affiliate", verifyUser, getAffiliateProducts);
router.get("/shop/:slug", forUserDetails);

//====================== For Admin =====================
router.post("/create", verifyAdmin, create);
router.get("/allForAdminIndex", verifyAdmin, allForAdminIndex);
router.get("/singleForEdit/:id", verifyAdmin, singleForEdit);
router.put("/update/:id", verifyAdmin, update);
router.delete("/delete/:id", verifyAdmin, deleteById);

export default router;
