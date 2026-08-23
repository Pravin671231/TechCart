import { Router } from "express";
import multer from "multer";
import { rbac, CATALOG_ADMIN_ROLES } from "@/middleware/rbac";
import { MAX_DIRECT_UPLOAD_BYTES } from "./uploads.service";
import { directUpload, presign } from "./uploads.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DIRECT_UPLOAD_BYTES },
});

const router = Router();
router.use(rbac(CATALOG_ADMIN_ROLES));

router.post("/presign", presign);
router.post("/direct", upload.single("file"), directUpload);

export default router;
