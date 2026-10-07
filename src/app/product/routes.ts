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
import { verifySuperAdmin, verifyUser } from "../../middleware/auth";
import { allForUserIndex, getProductTypes } from "./filter";

const router = Router();

//====================== For User ======================
router.get("/product-types", getProductTypes);
router.get("/shop", allForUserIndex);
router.get("/shop/slugs", getAllSlugs);
router.get("/affiliate", verifyUser, getAffiliateProducts);
router.get("/shop/:slug", forUserDetails);

//====================== For Super Admin =====================
router.post("/create", verifySuperAdmin, create);
router.get("/allForAdminIndex", verifySuperAdmin, allForAdminIndex);
router.get("/singleForEdit/:id", verifySuperAdmin, singleForEdit);
router.put("/update/:id", verifySuperAdmin, update);
router.delete("/delete/:id", verifySuperAdmin, deleteById);

export default router;
