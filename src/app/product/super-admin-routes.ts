import { Router } from "express";
import {
  allForAdminIndex,
  create,
  singleForEdit,
  update,
  deleteById,
} from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.post("/create", verifySuperAdmin, create);
router.get("/allForAdminIndex", verifySuperAdmin, allForAdminIndex);
router.get("/singleForEdit/:id", verifySuperAdmin, singleForEdit);
router.put("/update/:id", verifySuperAdmin, update);
router.delete("/delete/:id", verifySuperAdmin, deleteById);

export default router;
