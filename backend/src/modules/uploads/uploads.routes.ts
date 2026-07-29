import { Router } from "express";
import multer from "multer";
import { MAX_DIRECT_UPLOAD_BYTES } from "./uploads.service";
import { directUpload, presign } from "./uploads.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DIRECT_UPLOAD_BYTES },
});

const router = Router();

router.post("/presign", presign);
router.post("/direct", upload.single("file"), directUpload);

export default router;
