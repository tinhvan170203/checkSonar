const express = require('express');
const path = require('path')
const multer = require('multer')

var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        let id_user = req.userId.userId
        cb(null, path.join(__dirname,`../upload`))
    },
    filename: function(req, file, cb) {
        const originalName = file.originalname; // tên file gốc
        const encodedName = Buffer.from(originalName, 'latin1').toString('utf8'); // mã hóa tên file
        // cb(null, encodedName); // dùng tên file đã mã hóa
        cb(null, + new Date() + '_' + encodedName)
    }
})
var upload = multer({
    storage: storage,
});

const router = express.Router();
const checkRole = require('../middlewares/checkRole');
const middlewareController = require('../middlewares/verifyToken');
const updatecaicach = require('../controllers/updatecaicach');

router.get('/fetch',middlewareController.verifyToken, updatecaicach.getPhieuchams);
router.post('/add',middlewareController.verifyToken, updatecaicach.savePhieudiemConfig);
router.post('/copy',middlewareController.verifyToken, updatecaicach.copyPhieuchamConfig);
router.post('/update',middlewareController.verifyToken, updatecaicach.updatePhieuchamConfig);
router.get('/cuoc-cham-diem/fetch',middlewareController.verifyToken, updatecaicach.getListCuocchamdiem);
router.post('/cuoc-cham-diem/add',middlewareController.verifyToken, updatecaicach.createdCuocchamdiem);
router.delete('/cuoc-cham-diem/delete/:id',middlewareController.verifyToken, updatecaicach.deleteCuocChamDiem);

router.put('/cuoc-cham-diem/edit/:id',middlewareController.verifyToken, updatecaicach.updateCuocChamDiem);
router.get('/change-block-tu-cham',middlewareController.verifyToken, updatecaicach.changeStatusChotdiemTucham);
router.get('/change-block-giai-trinh',middlewareController.verifyToken, updatecaicach.changeStatusChotdiemGiaitrinh);
router.get('/theo-doi-qua-trinh-cham-diem',middlewareController.verifyToken, updatecaicach.theodoiQuatrinhCham);
router.get('/xoa-phieu-cham-diem/:id',middlewareController.verifyToken, updatecaicach.removePhieucham);

router.get('/xep-hang-diem-so',middlewareController.verifyToken, updatecaicach.xepHangDiemso);
router.get('/xep-hang-diem-don-vi-cap-3',middlewareController.verifyToken, updatecaicach.xepHangDiemCaNuocDonviCap3);
router.get('/check-phieu-cham-used',middlewareController.verifyToken, updatecaicach.checkPhieuchamUsed);
router.get('/xep-hang-linh-vuc',middlewareController.verifyToken, updatecaicach.xepHangTheoLinhvuc);
router.get('/xep-hang-tieu-chi',middlewareController.verifyToken, updatecaicach.xepHangTheoTieuchi);

router.get('/thong-bao', updatecaicach.fetchThongbao);
router.post('/save-thong-bao',middlewareController.verifyToken, updatecaicach.saveThongbao);
router.post('/save-file',middlewareController.verifyToken, upload.single('file'), updatecaicach.saveFile);
router.post('/save-ghi-chu',middlewareController.verifyToken, updatecaicach.updateGhichuFile);
router.get('/thong-bao/delete/:id',middlewareController.verifyToken, updatecaicach.deleteFile);
router.get('/download-file/login/:file', updatecaicach.downloadFileLoginPage);


router.post('/check-import', middlewareController.verifyToken, updatecaicach.checkImportUser);
module.exports = router