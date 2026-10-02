import { Router } from "express";
import { getSettings, updateSettings, updateCourseLink } from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

router.get("/", getSettings);
router.put("/", updateSettings);
router.patch("/", updateSettings);
router.patch("/course-link", verifyUser, updateCourseLink);

export default router;
