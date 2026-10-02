import { Router } from "express";
import { create, updateStatus, getStudentSubmissions, getTeacherSubmissions, getSubmissionProgress, resubmit } from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

router.post("/create", verifyUser, create);
router.put("/updateStatus/:id", verifyUser, updateStatus);
router.put("/resubmit/:id", verifyUser, resubmit);
router.get("/student/:studentId", verifyUser, getStudentSubmissions);
router.get("/teacher/:teacherId", verifyUser, getTeacherSubmissions);
router.get("/progress/:studentId", verifyUser, getSubmissionProgress);

export default router;
