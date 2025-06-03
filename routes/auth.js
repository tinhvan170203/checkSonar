const express = require('express');

const router = express.Router();

const auth = require('../controllers/auth');
const middlewareController = require('../middlewares/verifyToken');
const checkRole = require('../middlewares/checkRole');
// const middlewareController = require('../middlewares/verifyToken');

router.post('/login', auth.login )
router.post('/change-pass',  auth.changePassword )
router.get('/logout',  auth.logout)
router.get('/requestRefreshToken', auth.requestRefreshToken)
//route tạo tài khoản cấp bộ, cục, tỉnh
router.get('/user/fetch',middlewareController.verifyToken, auth.getUserList)
router.post('/user/add', middlewareController.verifyToken, auth.addUser)
router.post('/user/change-many-status', middlewareController.verifyToken, auth.changeStatusAccounts)
router.delete('/user/delete/:id',middlewareController.verifyToken, auth.deleteUser)
router.put('/user/edit/:id', middlewareController.verifyToken,  auth.editUser)


//route tạo tài khoản cấp phòng, xã của công an cấp tỉnh
router.get('/user/cap-tinh/fetch',middlewareController.verifyToken, auth.getUserListOfCapTinh)
router.post('/user/cap-tinh/add', middlewareController.verifyToken, auth.addUserOfCapTinh)
router.post('/user/cap-tinh/change-many-status', middlewareController.verifyToken, auth.changeStatusAccountsOfCapTinh)
router.delete('/user/cap-tinh/delete/:id',middlewareController.verifyToken, auth.deleteUserOfCapTinh)
router.put('/user/cap-tinh/edit/:id', middlewareController.verifyToken,  auth.editUserOfCapTinh)

//route lấy ra các tài khoản cấp tỉnh 
router.get('/user/list/cap-tinh/fetch',middlewareController.verifyToken, auth.getUserCapTinh)
router.get('/user/nhom-chuc-nang',middlewareController.verifyToken, auth.getNhomchucnang)

//lấy ra user cấp con của 1 user
router.get('/user/children',middlewareController.verifyToken, auth.fetchChildrenUser)
module.exports = router