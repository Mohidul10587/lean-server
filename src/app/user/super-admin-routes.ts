import { Router } from "express";
import {
  updateUserRole,
  getUserByIdForAdmin,
  updateUserByIdByAdmin,
  deleteUserByIdByAdmin,
  updatePasswordByAdmin,
  getTeachers,
  getUsersByRole,
  toggleUserStatus,
  filterUsers,
} from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";
import { getUsersAll } from "./filter/getUsersAll";

const router = Router();

router.get("/list", verifySuperAdmin, getUsersAll);
router.get("/filter", verifySuperAdmin, filterUsers);
router.get("/by-role", verifySuperAdmin, getUsersByRole);
router.get("/teachers", verifySuperAdmin, getTeachers);
router.get("/getUserByIdForAdmin/:id", verifySuperAdmin, getUserByIdForAdmin);
router.put("/update-role", verifySuperAdmin, updateUserRole);
router.put(
  "/updateUserByIdByAdmin/:id",
  verifySuperAdmin,
  updateUserByIdByAdmin
);
router.patch("/toggleUserStatus/:id", verifySuperAdmin, toggleUserStatus);
router.put(
  "/updatePasswordByAdmin/:id",
  verifySuperAdmin,
  updatePasswordByAdmin
);
router.put("/updateSalary/:id", verifySuperAdmin, updateUserByIdByAdmin);
router.delete(
  "/deleteUserByIdByAdmin/:id",
  verifySuperAdmin,
  deleteUserByIdByAdmin
);

export default router;
