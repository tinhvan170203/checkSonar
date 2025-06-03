const express = require('express');
const router = express.Router();
const checkRole = require('../middlewares/checkRole');
const middlewareController = require('../middlewares/verifyToken');

const caicachhanhchinh = require('../controllers/caicachhanhchinh');
const path = require('path')
const multer = require('multer')

var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        let id_user = req.userId.userId
        cb(null, path.join(__dirname,`../upload/${id_user}`))
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



router.get('/cham-diem/:id/change-year/fetch', middlewareController.verifyToken, caicachhanhchinh.handleChangeSelectNam);
router.post('/cham-diem/:id/:id_phieucham/upload/tai-lieu/add',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveUploadtailieu);
router.post('/cham-diem/:id/:id_phieucham/upload/tai-lieu-giai-trinh/add',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveUploadtailieuGiaitrinh);
router.post('/cham-diem/:id/save-data',middlewareController.verifyToken,   caicachhanhchinh.updateChamdiem);

router.get('/download/:file',middlewareController.verifyToken, caicachhanhchinh.downloadFile)
router.get('/chot-diem-tu-cham',middlewareController.verifyToken, caicachhanhchinh.checkedChotdiem);
// router.get('/print/bao-cao', middlewareController.verifyToken, caicachhanhchinh.createDocx);
router.post('/:id/chot-diem-tu-cham',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveChotdiemtucham);
router.post('/:id/chot-diem-giai-trinh',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveChotdiemGiaitrinh);

//fetch tài khoản địa phương
router.get('/tai-khoan-dia-phuong/fetch', middlewareController.verifyToken, checkRole(), caicachhanhchinh.fetchTaikhoanDiaphuong);
router.get('/bang-diem-tham-dinh/fetch', middlewareController.verifyToken, caicachhanhchinh.fetchBangchamthamdinh);

router.get('/tracking-bang-diem/fetch', middlewareController.verifyToken, checkRole(), caicachhanhchinh.trackingBangdiem);
router.get('/tracking-bang-diem-cap-xa/fetch', middlewareController.verifyToken, checkRole(), caicachhanhchinh.trackingBangdiemCapxa);
router.post('/:id/save-ghi-chu-tham-dinh',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.updateGhichuthamdinh);
router.post('/:id/save-ghi-chu-tham-dinh-lan-2',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.updateGhichuthamdinhlan2);
router.post('/cham-diem/:id/save-diem-tham-dinh',middlewareController.verifyToken,   caicachhanhchinh.saveDiemthamdinh);
router.post('/cham-diem/:id/:id_phieucham/upload/tai-lieu-diem-thuong/add',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveUploadtailieuDiemthuong);
router.post('/cham-diem/:id/:id_phieucham/upload/tai-lieu-diem-phat/add',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveUploadtailieuDiemphat);

router.post('/:id/save-ghi-chu-giai-trinh-diem-thuong',middlewareController.verifyToken,upload.array('files'),   caicachhanhchinh.saveUploadtailieuDiemthuongGiaitrinh);
router.post('/:id/save-ghi-chu-giai-trinh-diem-phat',middlewareController.verifyToken, upload.array('files'), caicachhanhchinh.saveUploadtailieuDiemphatGiaitrinh);
router.post('/:id/save-ghi-chu-tham-dinh-diem-thuong',middlewareController.verifyToken,upload.array('files'),   caicachhanhchinh.updateGhichuthamdinhDiemthuong);
router.post('/:id/save-ghi-chu-tham-dinh-diem-phat',middlewareController.verifyToken, upload.array('files'), caicachhanhchinh.updateGhichuthamdinhDiemphat);
router.post('/:id/save-ghi-chu-tham-dinh-diem-thuong-giai-trinh',middlewareController.verifyToken,upload.array('files'),   caicachhanhchinh.updateGhichuThamdinhDiemthuongGiaitrinh);
router.post('/:id/save-ghi-chu-tham-dinh-diem-phat-giai-trinh',middlewareController.verifyToken, upload.array('files'), caicachhanhchinh.updateGhichuThamdinhDiemphatGiaitrinh);
// router.post('/cham-diem/:id/save-diem-tham-dinh',middlewareController.verifyToken,   caicachhanhchinh.saveDiemthamdinh);

router.get('/change/status/chot-so', middlewareController.verifyToken, checkRole(), caicachhanhchinh.changeStatusChotdiem)
router.get('/chart', middlewareController.verifyToken,checkRole(),  caicachhanhchinh.getDataOfChart)
router.get('/xep-loai-cap-xa', middlewareController.verifyToken,checkRole(),  caicachhanhchinh.getDataXeploaiCapxa);
router.get('/thoi-han-cham/fetch',middlewareController.verifyToken,   caicachhanhchinh.getQuantrichamdiems);
router.post('/thoi-han-cham/add', middlewareController.verifyToken, checkRole(), caicachhanhchinh.addQuantrichamdiem);
router.put('/thoi-han-cham/edit/:id',middlewareController.verifyToken, checkRole(),  caicachhanhchinh.updateQuantrichamdiem);
router.delete('/thoi-han-cham/delete/:id',middlewareController.verifyToken, checkRole(),  caicachhanhchinh.deleteQuantrichamdiem);
router.delete('/xoa-phieu-cham/delete/:id',middlewareController.verifyToken,   caicachhanhchinh.resetPhieuchamdiem);

router.get('/file/upload/:id', middlewareController.verifyToken, caicachhanhchinh.fetchFileUploadTucham)
router.post('/file/upload',middlewareController.verifyToken, upload.array('files'),  caicachhanhchinh.saveTailieuUpload);
router.post('/file/upload/delete',middlewareController.verifyToken,   caicachhanhchinh.deleteTailieuUpload);
router.get('/fetch/system-history', middlewareController.verifyToken, caicachhanhchinh.fetchLichsuHethong)

module.exports = router