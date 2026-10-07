import { Router } from "express";
import {
  register,
  login,
  loginStudent,
  loginSuperAdmin,
  loginOthers,
  verify,
  logout,
  filterUsers,
  refresh,
  updateProfile,
  updateUserRole,
  changePassword,
  updateSettings,
  getUserByIdForAdmin,
  updateUserByIdByAdmin,
  deleteUserByIdByAdmin,
  updatePasswordByAdmin,
  activateAccount,
  addWithdrawNumber,
  getTeachers,
  getUsersByRole,
  listForTrainer,
  listForSeniorTeamLeader,
  teamLeadersForSTL,
  trainersForSTL,
  trainersForTL,
  myTeamForTeamLeader,
  myTeamForSeniorTeamLeader,
  studentsOfTrainer,
  unassignedStudentsForTL,
  assignTrainerToStudent,
  changeStudentTrainer,
  myReferralsForSTL,
  myReferralsForTrainer,
  getInactiveStudentsForController,
  getCounselors,
  assignCounselor,
  getMyStudentsForCounselor,
  getTrainersAndTeamLeaders,
  toggleUserStatus,
  makeStudentTrainer,
  makeTrainerStudent,
  removeCounselor,
  removeTrainerFromStudent,
  specialUsers,
  getAllTeamLeaders,
  getOrphanedUsersByTeamLeader,
  bulkReassignTeamLeader,
  toggleMessaged,
} from "./controller";
import {
  verifyUser,
  verifySuperAdmin,
  verifyUserInactive,
} from "../../middleware/auth";
import { getUsersAll } from "./filter/getUsersAll";
import { listForTeamLeader } from "./filter/listForTeamLeader";
import { getMyReferralsNetwork } from "./filter/getMyReferralsNetwork";
import { getReferredStudentsByTLUserId } from "./filter/getReferredStudentsByTLUserId";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/login/student", loginStudent);
router.post("/login/super-admin", loginSuperAdmin);
router.post("/login/others", loginOthers);
router.get("/verify", verify);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/list", verifySuperAdmin, getUsersAll);
router.get("/filter", verifySuperAdmin, filterUsers);
router.get("/by-role", verifySuperAdmin, getUsersByRole);

router.get("/teachers", verifyUser, getTeachers);
router.get("/specialUsers", verifySuperAdmin, specialUsers);

router.get(
  "/getUserByIdForAdmin/:id",
  verifySuperAdmin,
  getUserByIdForAdmin
);

router.put("/update", verifyUser, updateProfile);
router.put("/update-role", verifySuperAdmin, updateUserRole);
router.put(
  "/updateUserByIdByAdmin/:id",
  verifySuperAdmin,
  updateUserByIdByAdmin
);
router.patch(
  "/toggleUserStatus/:id",
  verifySuperAdmin,
  toggleUserStatus
);
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
router.get("/team-leaders", verifySuperAdmin, getAllTeamLeaders);
router.get("/orphaned-users", verifySuperAdmin, getOrphanedUsersByTeamLeader);
router.post("/bulk-reassign-tl", verifySuperAdmin, bulkReassignTeamLeader);
router.put("/change-password", verifyUser, changePassword);
router.put("/update-settings", verifyUser, updateSettings);
router.post("/activate-account", verifyUserInactive, activateAccount);
router.post("/add-withdraw-number", verifyUser, addWithdrawNumber);

router.get("/listForTrainer", verifyUser, listForTrainer);
router.get("/listForTeamLeader", verifyUser, listForTeamLeader);
router.get("/listForSeniorTeamLeader", verifyUser, listForSeniorTeamLeader);
router.get("/teamLeadersForSTL", verifyUser, teamLeadersForSTL);
router.get("/trainersForSTL", verifyUser, trainersForSTL);
router.get("/trainersForTL", verifyUser, trainersForTL);
router.get("/myTeamForTeamLeader", verifyUser, myTeamForTeamLeader);
router.get("/myTeamForSeniorTeamLeader", verifyUser, myTeamForSeniorTeamLeader);
router.get("/studentsOfTrainer/:trainerId", verifyUser, studentsOfTrainer);
router.get("/unassignedStudentsForTL", verifyUser, unassignedStudentsForTL);
router.post("/assignTrainerToStudent", verifyUser, assignTrainerToStudent);
router.post("/changeStudentTrainer", verifyUser, changeStudentTrainer);
router.post("/makeStudentTrainer", verifyUser, makeStudentTrainer);
router.post("/makeTrainerStudent", verifyUser, makeTrainerStudent);
router.delete(
  "/removeTrainerFromStudent/:studentId",
  verifyUser,
  removeTrainerFromStudent
);

router.get(
  "/inactiveStudentsForController",
  verifyUser,
  getInactiveStudentsForController
);
router.get("/counselors", verifyUser, getCounselors);
router.post("/assignCounselor", verifyUser, assignCounselor);
router.delete("/removeCounselor/:studentId", verifyUser, removeCounselor);
router.get("/getMyReferralsNetwork", verifyUser, getMyReferralsNetwork);
router.get("/myReferralsForSTL", verifyUser, myReferralsForSTL);
router.get("/myReferralsForTrainer", verifyUser, myReferralsForTrainer);
router.get("/myStudentsForCounselor", verifyUser, getMyStudentsForCounselor);
router.get("/trainers-and-team-leaders", verifyUser, getTrainersAndTeamLeaders);

// Referral panel route — uses logged-in user's _id
router.get(
  "/getReferredStudentsByTLUserId",
  verifyUser,
  getReferredStudentsByTLUserId
);

router.patch("/toggle-messaged/:userId", verifyUser, toggleMessaged);

export default router;
