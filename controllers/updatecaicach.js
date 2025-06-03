
const Phieuchamdiems = require("../models/Phieuchamdiem");
const PhieudiemNew = require("../models/PhieudiemNew");
const QuantriNamChamdiem = require("../models/QuanlyNamChamdiem");
const Users = require("../models/Users");
const path = require('path');
const fs = require('fs');
const Thongbao = require("../models/Thongbao");
const HistoriesSystem = require("../models/HistoriesSystem");
const Joi = require('joi');
const saveAction = async (user_id, action) => {
    let newAction = new HistoriesSystem({
        user: user_id,
        action: action
    })
    await newAction.save();
};


module.exports = {
    getPhieuchams: async (req, res) => {
        let { id_user } = req.query;
        const schema = Joi.object({
            id_user: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            id_user
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        try {
            let items = await PhieudiemNew.find({ user_created: value.id_user }).sort({ createdAt: -1 });
            res.status(200).json(items);
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    savePhieudiemConfig: async (req, res) => {
        try {
            let item = new PhieudiemNew(req.body);
            await item.save();
            await saveAction(req.userId.userId, `Cấu hình phiếu chấm điểm ${req.body.name}`)
            res.status(200).json({ message: "Tạo phiếu chấm điểm thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    copyPhieuchamConfig: async (req, res) => {
        let id = req.body.id;
        try {
            let item = await PhieudiemNew.findById(id);
            let data = {
                name: item.name + " Copy",
                phieuchamdiem: item.phieuchamdiem,
                user_created: item.user_created
            };
            let copy = new PhieudiemNew(data);
            await copy.save();
            await saveAction(req.userId.userId, `Nhân bản phiếu chấm điểm ${item.name}`)
            let items = await PhieudiemNew.find({ user_created: item.user_created }).sort({ createdAt: -1 });
            res.status(200).json({ items, message: "Nhân bản phiếu chấm điểm thành công" });
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    updatePhieuchamConfig: async (req, res) => {
        let id = req.body.id;
        let id_user = req.body.data.id_user
        // console.log(req.body.data)
        const schema = Joi.object({
            id_user: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            id_user
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        try {
            await PhieudiemNew.findByIdAndUpdate(id, req.body.data);
            // console.log(id_user)
            let items = await PhieudiemNew.find({ user_created: value.id_user }).sort({ createdAt: -1 });
            // console.log(items)
            await saveAction(req.userId.userId, `Cấu hình phiếu chấm điểm ${req.body.data.name}`)
            res.status(200).json({ items, message: "Update phiếu chấm điểm thành công" });
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    // hàm tạo cuộc chấm điểm trong năm
    createdCuocchamdiem: async (req, res) => {
        let data = req.body;
        // console.log(data)
        const schema = Joi.object({
            user_created: Joi.string().required(),
            nam: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            user_created: req.body.user_created,
            nam: req.body.nam,
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        try {
            // check xem đã có  cuộc chấm điểm năm muốn tạo của user đã tạo chưa
            let check = await QuantriNamChamdiem.findOne({
                nam: value.nam,
                user_created: value.user_created
            });

            if (check !== null) {
                return res.status(401).json({
                    status: "failed",
                    message: "Có lỗi xảy ra do đã có cuộc chấm điểm năm của đơn vị trong hệ thống. Vui lòng xem lại danh sách cuộc chấm điểm",
                });
            };

            let item = new QuantriNamChamdiem(data)
            await item.save();
            let items = await QuantriNamChamdiem.find({ user_created: value.user_created }).populate('setting.phieucham', { name: 1 }).sort({ nam: -1 })
            await saveAction(req.userId.userId, `Tạo cuộc chấm điểm năm ${req.body.nam}`)
            res.status(200).json({ items, message: "Tạo cuộc chấm điểm thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    getListCuocchamdiem: async (req, res) => {
        let { id_user } = req.query;
        const schema = Joi.object({
            id_user: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            id_user
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        try {
            let items = await QuantriNamChamdiem.find({ user_created: value.id_user }).populate('setting.phieucham', { name: 1 }).sort({ nam: -1 })
            res.status(200).json(items)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },
    deleteCuocChamDiem: async (req, res) => {
        let { id } = req.params;
        try {
            let item = await QuantriNamChamdiem.findById(id);
            let list_id_phieucham = [];
            let id_user = item.user_created;
            item.setting.forEach(i => list_id_phieucham.push(i.phieucham));

            //xóa hết phiếu tự chấm điểm có các phiếu chấm thuộc danh sách đã cấu hình cho cuocj chấm điểm
            //xóa hết các file đã tải lên của user đã chấm điểm
            let phieuchamdiems_da_cham = await Phieuchamdiems.find({ phieuchamdiem: { $in: list_id_phieucham } })
            for (let phieucham of phieuchamdiems_da_cham) {
                let all_files = [];
                let phieuchamdiem_detail = phieucham.phieuchamdiem_detail;
                for (let detail of phieuchamdiem_detail) {
                    detail.tieuchi_group.forEach(tieuchi => {
                        tieuchi.tieuchithanhphan_group.forEach(thanhphan => {
                            all_files = all_files.concat(thanhphan.files).concat(thanhphan.files_bosung)
                        });
                    })
                };

                let taikhoan = phieucham.taikhoan.toString();

                all_files = all_files.concat(phieucham.ghichudiemthuong.files)
                    .concat(phieucham.ghichudiemphat.files)
                    .concat(phieucham.ghichudiemphatgiaitrinh.files)
                    .concat(phieucham.ghichudiemthuonggiaitrinh.files);


                for (let i of all_files) {
                    let path_delete = path.join(__dirname, `../upload/${taikhoan}/` + i);
                    if (fs.existsSync(path_delete)) {
                        fs.unlinkSync(path.join(__dirname, `../upload/${taikhoan}/` + i));
                        console.log(`The file ${path_delete} exists.`);
                    } else {
                        console.log(`The file ${path_delete} does not exist.`);
                    }
                };
            };

            await Phieuchamdiems.deleteMany({
                phieuchamdiem: { $in: list_id_phieucham }
            });

            await QuantriNamChamdiem.findByIdAndDelete(id);
            await saveAction(req.userId.userId, `Xóa cuộc chấm điểm năm ${item.nam}`)
            let items = await QuantriNamChamdiem.find({ user_created: id_user }).populate('setting.phieucham', { name: 1 }).sort({ nam: -1 })
            res.status(200).json({ items, message: "Xóa cuộc chấm điểm thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },
    updateCuocChamDiem: async (req, res) => {
        let { id } = req.params;
        // console.log(id)
        try {
            let item = await QuantriNamChamdiem.findByIdAndUpdate(id, req.body);

            let items = await QuantriNamChamdiem.find({ user_created: item.user_created }).populate('setting.phieucham', { name: 1 }).sort({ nam: -1 })
            await saveAction(req.userId.userId, `Update cuộc chấm điểm năm ${req.body.nam}`)
            res.status(200).json({ items, message: "Update cuộc chấm điểm thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    changeStatusChotdiemTucham: async (req, res) => {
        // console.log('123')
        let { id_phieucham } = req.query;
        try {
            let phieucham = await Phieuchamdiems.findById(id_phieucham).populate('taikhoan');
            phieucham.chotdiemtucham.status = !phieucham.chotdiemtucham.status;
            // console.log(phieucham.chotdiemtucham.status)
            await phieucham.save();
            await saveAction(req.userId.userId, `Thay đổi trạng thái chốt điểm tự chấm phiếu chấm điểm ${phieucham.taikhoan.tenhienthi} năm ${phieucham.year}`)
            res.status(200).json({ message: "Thay đổi trạng thái tự chấm điểm thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },
    changeStatusChotdiemGiaitrinh: async (req, res) => {
        let { id_phieucham } = req.query;
        try {
            let phieucham = await Phieuchamdiems.findById(id_phieucham).populate('taikhoan');
            phieucham.chotdiemgiaitrinh.status = !phieucham.chotdiemgiaitrinh.status;
            await phieucham.save();
            await saveAction(req.userId.userId, `Thay đổi trạng thái chốt điểm giải trình phiếu chấm điểm ${phieucham.taikhoan.tenhienthi} năm ${phieucham.year}`)
            res.status(200).json({ message: "Thay đổi trạng thái tự giải trình điểm giải trình thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({
                status: "failed",
                message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên",
            });
        }
    },

    theodoiQuatrinhCham: async (req, res) => {
        let { id_user, year } = req.query;
        const schema = Joi.object({
            id_user: Joi.string().required(),
            year: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            id_user: id_user,
            year: year,
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        let cuocChamDiem = await QuantriNamChamdiem.findOne({ user_created: value.id_user, nam: value.year });
        if (cuocChamDiem === null) {
            return res.status(401).json({ status: "failed", message: "Chưa có cuộc chấm điểm năm " + year });
        }
        try {
            let items = await Users.find({ capcha: value.id_user }, { _id: 1, tenhienthi: 1, time_block: 1, status: 1, nhom: 1, taikhoancap: 1 }).sort({ thutu: 1 });
            // console.log(items)
            // tìm ra các user yêu cầu chấm điểm năm đó
            items = items.filter(e => {
                let date_start_chamdiem = (new Date(cuocChamDiem.thoigianbatdautucham)).getTime();
                let date_block_user = e.status === true ? (new Date(e.time_block)).getTime() : (new Date()).getTime()
                let check = (e.status === false && date_start_chamdiem > date_block_user)
                return e.status === true || check
            });

            //lọc qua các user để lấy ra trạng thái quá trình chấm điểm
            let data = [];

            for (let user of items) {
                // tìm xem đã có phiếu tự chấm điểm chưa, nếu chưa có thì chưa chấm điểm
                let phieuchamdiem_of_user = await Phieuchamdiems.findOne({
                    taikhoan: user._id,
                    year: year
                });

                if (phieuchamdiem_of_user === null) {
                    //TH chưa tự chấm điểm
                    data.push({
                        user: user,
                        status_chotdiemtucham: false,
                        status_chotdiemgiaitrinh: false,
                        time_chotdiemtucham: null,
                        time_chotdiemgiaitrinh: null,
                        id_phieucham: null
                    })
                } else {
                    data.push({
                        user: user,
                        id_phieucham: phieuchamdiem_of_user._id,
                        status_chotdiemtucham: phieuchamdiem_of_user.chotdiemtucham.status,
                        status_chotdiemgiaitrinh: phieuchamdiem_of_user.chotdiemgiaitrinh.status,
                        time_chotdiemtucham: phieuchamdiem_of_user.chotdiemgiaitrinh.status === true ?
                            phieuchamdiem_of_user.chotdiemtucham.time : null,
                        time_chotdiemgiaitrinh: phieuchamdiem_of_user.chotdiemgiaitrinh.status === true ?
                            phieuchamdiem_of_user.chotdiemgiaitrinh.time : null,
                    })
                }
            };

            res.status(200).json(data)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    removePhieucham: async (req, res) => {
        let id = req.params.id; // id phiếu chấm muốn xóa
        try {
            // xóa tất cả các file đã tải lên trong phiếu chấm đó
            let phieucham = await Phieuchamdiems.findById(id);
            let all_files = [];
            let phieuchamdiem_detail = phieucham.phieuchamdiem_detail;
            for (let detail of phieuchamdiem_detail) {
                detail.tieuchi_group.forEach(tieuchi => {
                    tieuchi.tieuchithanhphan_group.forEach(thanhphan => {
                        all_files = all_files.concat(thanhphan.files).concat(thanhphan.files_bosung)
                    });
                })
            };

            let taikhoan = phieucham.taikhoan.toString();

            all_files = all_files.concat(phieucham.ghichudiemthuong.files)
                .concat(phieucham.ghichudiemphat.files)
                .concat(phieucham.ghichudiemphatgiaitrinh.files)
                .concat(phieucham.ghichudiemthuonggiaitrinh.files);


            for (let i of all_files) {
                let path_delete = path.join(__dirname, `../upload/${taikhoan}/` + i);
                if (fs.existsSync(path_delete)) {
                    fs.unlinkSync(path.join(__dirname, `../upload/${taikhoan}/` + i));
                    console.log(`The file ${path_delete} exists.`);
                } else {
                    console.log(`The file ${path_delete} does not exist.`);
                }
            };

            await Phieuchamdiems.findByIdAndRemove(id);
            res.status(200).json({ message: "Xóa phiếu chấm điểm thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    xepHangDiemso: async (req, res) => {
        let { id_user, year } = req.query;
        const schema = Joi.object({
            id_user: Joi.string().required(),
            year: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            id_user: id_user,
            year: year,
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        let cuocChamDiem = await QuantriNamChamdiem.findOne({ user_created: value.id_user, nam: value.year });
        if (cuocChamDiem === null) {
            return res.status(401).json({ status: "failed", message: "Chưa có cuộc chấm điểm năm " + year });
        }
        try {
            let items = await Users.find({ capcha: value.id_user }, { _id: 1, tenhienthi: 1, time_block: 1, status: 1, nhom: 1, taikhoancap: 1 }).sort({ thutu: 1 });
            // console.log(items)
            // tìm ra các user yêu cầu chấm điểm năm đó
            items = items.filter(e => {
                let date_start_chamdiem = (new Date(cuocChamDiem.thoigianbatdautucham)).getTime();
                let date_block_user = e.status === true ? (new Date(e.time_block)).getTime() : (new Date()).getTime()
                let check = (e.status === false && date_start_chamdiem > date_block_user)
                return e.status === true || check
            });

            //lọc qua các user để lấy ra dữ liệu
            let data = [];

            for (let user of items) {
                // tìm xem đã có phiếu tự chấm điểm chưa, nếu chưa có thì chưa chấm điểm
                let phieuchamdiem_of_user = await Phieuchamdiems.findOne({
                    taikhoan: user._id,
                    year: year
                });

                if (phieuchamdiem_of_user === null) {
                    //TH chưa tự chấm điểm
                    data.push({
                        user: user,
                        nhomchucnang: user.nhom,
                        diemtucham: 0,
                        diemthamdinhlan1: 0,
                        diemthamdinhlan2: 0
                    })
                } else {
                    let list = phieuchamdiem_of_user.phieuchamdiem_detail;

                    let total_diemtucham = 0;
                    let total_diemthamdinhlan1 = 0;
                    let total_diemthamdinhlan2 = 0;
                    for (let i of list) {
                        //check xem lĩnh vực nào được sử dụng cho cấp, cho năm
                        let total_diemtuchamlinhvuc = 0;
                        let total_diemthamdinhlinhvuc = 0;
                        let total_diemthamdinhlinhvuclan2 = 0;

                        //lọc qua từng tiêu chí của  lĩnh vực đẻ tính điểm cho lĩnh vực
                        let tieuchiList = [];
                        for (let tieuchi of i.tieuchi_group) {
                            let total_diemtuchamtieuchi = 0;
                            let total_diemthamdinhtieuchi = 0;
                            let total_diemthamdinhtieuchilan2 = 0;


                            //lọc qua từng tiêu chí thành phần để tính điểm của tiêu chí
                            for (let tieuchithanhphan of tieuchi.tieuchithanhphan_group) {
                                total_diemtuchamtieuchi += tieuchithanhphan.diemtuchamlan1;
                                total_diemthamdinhtieuchi += tieuchithanhphan.diemthamdinhlan1;
                                total_diemthamdinhtieuchilan2 += tieuchithanhphan.diemthamdinhlan2;

                                total_diemtuchamlinhvuc += tieuchithanhphan.diemtuchamlan1;
                                total_diemthamdinhlinhvuc += tieuchithanhphan.diemthamdinhlan1;
                                total_diemthamdinhlinhvuclan2 += tieuchithanhphan.diemthamdinhlan2;
                            };

                            tieuchiList.push({
                                tieuchithanhphan_group: tieuchi.tieuchithanhphan_group,
                                tieuchi: {
                                    text: tieuchi.tieuchi.text,
                                    diemtoida: tieuchi.tieuchi.diemtoida,
                                    thutu: tieuchi.tieuchi.thutu,
                                    diemtucham: total_diemtuchamtieuchi,
                                    diemthamdinhlan1: total_diemthamdinhtieuchi,
                                    diemthamdinhlan2: total_diemthamdinhtieuchilan2,
                                },
                                _id: tieuchi._id
                            });
                        };

                        total_diemtucham += total_diemtuchamlinhvuc;
                        total_diemthamdinhlan1 += total_diemthamdinhlinhvuc;
                        total_diemthamdinhlan2 += total_diemthamdinhlinhvuclan2;
                    };

                    total_diemtucham += phieuchamdiem_of_user.diemthuongtucham - phieuchamdiem_of_user.diemphattucham;
                    total_diemthamdinhlan1 += phieuchamdiem_of_user.diemthuong - phieuchamdiem_of_user.diemphat;
                    total_diemthamdinhlan2 += phieuchamdiem_of_user.diemthuongthamdinhlan2 - phieuchamdiem_of_user.diemphatthamdinhlan2;

                    data.push({
                        user: user,
                        diemtucham: total_diemtucham,
                        nhomchucnang: phieuchamdiem_of_user.nhomchucnang,
                        diemthamdinhlan1: total_diemthamdinhlan1,
                        diemthamdinhlan2: total_diemthamdinhlan2
                    });
                }
            };
            // console.log(data.length)
            data = data.sort((a, b) => b.diemthamdinhlan2 - a.diemthamdinhlan2)
            res.status(200).json(data)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    xepHangDiemCaNuocDonviCap3: async (req, res) => {
        let { year } = req.query;
        const schema = Joi.object({
            year: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            year: year,
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        try {
            // lấy ra danh sách các tài khoản cấp Tỉnh sử dụng hết năm year
            let users_cap_tinh = await Users.find({
                taikhoancap: "Cấp Tỉnh"
            });

            users_cap_tinh = users_cap_tinh.filter(e => {
                let date_start_chamdiem = (new Date(`${year}-12-31T23:59:59.527Z`)).getTime();
                let date_block_user = e.status === true ? (new Date(e.time_block)).getTime() : (new Date()).getTime()
                let check = (e.status === false && date_start_chamdiem > date_block_user)
                return e.status === true || check
            });

            let data = [];
            // tìm ra các user thuộc từng tỉnh sau đó tìm ra bảng điểm của  từng đơn vị
            for (let user of users_cap_tinh) {
                let cuocChamDiem = await QuantriNamChamdiem.findOne({ user_created: user._id, nam: value.year });
                if (cuocChamDiem === null) {
                    continue
                };

                //tìm ra các tài khoản cấp 3
                let items = await Users.find({ capcha: user._id }, { _id: 1, tenhienthi: 1, time_block: 1, status: 1, nhom: 1, taikhoancap: 1 }).sort({ thutu: 1 });
                // console.log(items)
                // tìm ra các user yêu cầu chấm điểm năm đó
                items = items.filter(e => {
                    let date_start_chamdiem = (new Date(cuocChamDiem.thoigianbatdautucham)).getTime();
                    let date_block_user = e.status === true ? (new Date(e.time_block)).getTime() : (new Date()).getTime()
                    let check = (e.status === false && date_start_chamdiem > date_block_user)
                    return e.status === true || check
                });

                for (let item of items) {
                    // tìm xem đã có phiếu tự chấm điểm chưa, nếu chưa có thì chưa chấm điểm
                    let phieuchamdiem_of_user = await Phieuchamdiems.findOne({
                        taikhoan: item._id,
                        year: value.year
                    });

                    if (phieuchamdiem_of_user === null) {
                        //TH chưa tự chấm điểm
                        data.push({
                            user: item,
                            diemtucham: 0,
                            diemthamdinhlan1: 0,
                            diemthamdinhlan2: 0,
                            nhomchucnang: item.nhom
                        })
                    } else {
                        let list = phieuchamdiem_of_user.phieuchamdiem_detail;

                        let total_diemtucham = 0;
                        let total_diemthamdinhlan1 = 0;
                        let total_diemthamdinhlan2 = 0;
                        for (let i of list) {
                            //check xem lĩnh vực nào được sử dụng cho cấp, cho năm
                            let total_diemtuchamlinhvuc = 0;
                            let total_diemthamdinhlinhvuc = 0;
                            let total_diemthamdinhlinhvuclan2 = 0;

                            //lọc qua từng tiêu chí của  lĩnh vực đẻ tính điểm cho lĩnh vực
                            let tieuchiList = [];
                            for (let tieuchi of i.tieuchi_group) {
                                let total_diemtuchamtieuchi = 0;
                                let total_diemthamdinhtieuchi = 0;
                                let total_diemthamdinhtieuchilan2 = 0;


                                //lọc qua từng tiêu chí thành phần để tính điểm của tiêu chí
                                for (let tieuchithanhphan of tieuchi.tieuchithanhphan_group) {
                                    total_diemtuchamtieuchi += tieuchithanhphan.diemtuchamlan1;
                                    total_diemthamdinhtieuchi += tieuchithanhphan.diemthamdinhlan1;
                                    total_diemthamdinhtieuchilan2 += tieuchithanhphan.diemthamdinhlan2;

                                    total_diemtuchamlinhvuc += tieuchithanhphan.diemtuchamlan1;
                                    total_diemthamdinhlinhvuc += tieuchithanhphan.diemthamdinhlan1;
                                    total_diemthamdinhlinhvuclan2 += tieuchithanhphan.diemthamdinhlan2;
                                };

                                tieuchiList.push({
                                    tieuchithanhphan_group: tieuchi.tieuchithanhphan_group,
                                    tieuchi: {
                                        text: tieuchi.tieuchi.text,
                                        diemtoida: tieuchi.tieuchi.diemtoida,
                                        thutu: tieuchi.tieuchi.thutu,
                                        diemtucham: total_diemtuchamtieuchi,
                                        diemthamdinhlan1: total_diemthamdinhtieuchi,
                                        diemthamdinhlan2: total_diemthamdinhtieuchilan2,
                                    },
                                    _id: tieuchi._id
                                });
                            };

                            total_diemtucham += total_diemtuchamlinhvuc;
                            total_diemthamdinhlan1 += total_diemthamdinhlinhvuc;
                            total_diemthamdinhlan2 += total_diemthamdinhlinhvuclan2;
                        };

                        total_diemtucham += phieuchamdiem_of_user.diemthuongtucham - phieuchamdiem_of_user.diemphattucham;
                        total_diemthamdinhlan1 += phieuchamdiem_of_user.diemthuong - phieuchamdiem_of_user.diemphat;
                        total_diemthamdinhlan2 += phieuchamdiem_of_user.diemthuongthamdinhlan2 - phieuchamdiem_of_user.diemphatthamdinhlan2;

                        data.push({
                            user: item,
                            nhomchucnang: phieuchamdiem_of_user.nhomchucnang,
                            diemtucham: total_diemtucham,
                            diemthamdinhlan1: total_diemthamdinhlan1,
                            diemthamdinhlan2: total_diemthamdinhlan2
                        });
                    }
                };
            };

            data = data.sort((a, b) => b.diemthamdinhlan2 - a.diemthamdinhlan2)
            res.status(200).json(data)

        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    checkPhieuchamUsed: async (req, res) => {
        let id_phieucham = req.query.id_phieucham;
        const schema = Joi.object({
            id_phieucham: Joi.string().required(),
        });

        const { error, value } = schema.validate({
            id_phieucham: id_phieucham,
        });
        if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
        };
        try {
            let check_nam_cham_diem_used = await QuantriNamChamdiem.find({
                "setting.phieucham": value.id_phieucham
            });

            let check = false;
            if (check_nam_cham_diem_used.length > 0) {
                check = true
            };
            res.status(200).json(check)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    fetchThongbao: async (req, res) => {
        try {
            let item = await Thongbao.findOne();
            if (item === null) {
                let newItem = new Thongbao({
                    title: "",
                    noidung: "",
                    files: []
                });
                await newItem.save();
                return res.status(200).json(newItem)
            };
            res.status(200).json(item)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    saveThongbao: async (req, res) => {
        try {
            let thongbao = await Thongbao.findOne();
            thongbao.title = req.body.title;
            thongbao.noidung = req.body.noidung;
            await thongbao.save();
            res.status(200).json({ message: "Lưu thông báo thành công" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    saveFile: async (req, res) => {
        let index = req.file.path.lastIndexOf('\\');
        let link = req.file.path.slice(index + 1)
        try {
            let thongbao = await Thongbao.findOne();
            thongbao.files.push({ text: req.body.text, link })
            await thongbao.save();
            res.status(200).json(thongbao.files)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    updateGhichuFile: async (req, res) => {
        let id = req.body.id;
        try {
            let thongbao = await Thongbao.findOne();
            thongbao.files = thongbao.files.map(e => {
                if (e._id.toString() === id) {
                    return ({
                        ...e,
                        text: req.body.text
                    })
                } else {
                    return e
                }
            })
            await thongbao.save();
            res.status(200).json(thongbao.files)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    deleteFile: async (req, res) => {
        let id = req.params.id;
        let file = req.query.file;
        //    console.log(req.query)
        try {
            let thongbao = await Thongbao.findOne();
            thongbao.files = thongbao.files.filter(e => e._id.toString() !== id)
            // Lấy tên file sạch, loại bỏ mọi ký tự đặc biệt hoặc phần đường dẫn ngoài
            const safeFileName = path.basename(file);

            // Xây dựng đường dẫn tuyệt đối tới thư mục upload
            const uploadDir = path.join(__dirname, '../upload');

            // Tạo đường dẫn hoàn chỉnh tới file cần xóa
            const filePath = path.join(uploadDir, safeFileName);

            try {
                // Kiểm tra file có tồn tại hay không
                if (fs.existsSync(filePath)) {
                    // Thực hiện xóa file
                    fs.unlinkSync(filePath);
                    console.log(`Đã xóa file: ${filePath}`);
                } else {
                    console.log('File không tồn tại.');
                }
            } catch (err) {
                console.error('Lỗi khi xóa file:', err);
            }

            // console.log(thongbao)
            await thongbao.save();
            res.status(200).json(thongbao.files)
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    downloadFileLoginPage: async (req, res) => {
        try {
            //  let file = req.params.file;
            //     let path_file = path.join(
            //       __dirname,
            //       `../upload/` + file
            //     );
            //     res.download(path_file, file, function (err) {
            //       if (err) {
            //         console.log(err);
            //       } else {
            //         console.log("Tải file xuống thành công");
            //       }
            //     });
            // Lấy tên file thuần
            const safeFileName = path.basename(req.params.file);


            // Xác thực tên file hợp lệ (ví dụ: chỉ cho phép ký tự chữ, số, dấu gạch dưới, dấu chấm)
            const validNameRegex = /^[a-zA-Z0-9_\-.]+$/;
            if (!validNameRegex.test(safeFileName)) {
                return res.status(400).json({ message: 'Invalid file name.' });
            }

            const filePath = path.join(__dirname, '../upload', safeFileName);

            // Kiểm tra file có tồn tại không
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ message: 'File not found.' });
            }

            // Gửi file
            res.download(filePath, safeFileName, (err) => {
                if (err) {
                    console.error('Download error:', err);
                    res.status(500).json({ message: 'Error downloading file.' });
                }
            });
        } catch (error) {
            console.log(error.message)
        }
    },

    xepHangTheoLinhvuc: async (req, res) => {
        let { year, id_user, nhom } = req.query;
        // console.log(req.query)
           const schema = Joi.object({
                year: Joi.string().required(),
                id_user: Joi.string().required(),
                nhom: Joi.string().required(),
              });
        
              const { error, value } = schema.validate({
                year: year,
                id_user: id_user,
                nhom
              });
              if (error) {
                return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
              };
        try {
            let check_nam_cham_diem_used = await QuantriNamChamdiem.findOne({ user_created: value.id_user, nam: value.year })
            if (check_nam_cham_diem_used === null) {
                return res.status(401).json({ message: "Chưa có cuộc chấm điểm năm " + year })
            };
            let x = check_nam_cham_diem_used.setting.find(e => e.nhom === value.nhom);

            let id_phieucham = x.phieucham;
            let phieucham = await PhieudiemNew.findById(id_phieucham);
            let items = await Phieuchamdiems.find({ year: value.year, phieuchamdiem: id_phieucham }).populate('taikhoan', { _id: 1, tenhienthi: 1 })
            // console.log(phieucham)
            let data = []
            for (let item of items) {
                let list = item.phieuchamdiem_detail;
                let data_linhvuc = []
                for (let i of list) {
                    //check xem lĩnh vực nào được sử dụng cho cấp, cho năm
                    let total_diemtuchamlinhvuc = 0;
                    let total_diemthamdinhlinhvuc = 0;
                    let total_diemthamdinhlinhvuclan2 = 0;


                    for (let tieuchi of i.tieuchi_group) {
                        let total_diemtuchamtieuchi = 0;
                        let total_diemthamdinhtieuchi = 0;
                        let total_diemthamdinhtieuchilan2 = 0;


                        //lọc qua từng tiêu chí thành phần để tính điểm của tiêu chí
                        for (let tieuchithanhphan of tieuchi.tieuchithanhphan_group) {
                            total_diemtuchamtieuchi += tieuchithanhphan.diemtuchamlan1;
                            total_diemthamdinhtieuchi += tieuchithanhphan.diemthamdinhlan1;
                            total_diemthamdinhtieuchilan2 += tieuchithanhphan.diemthamdinhlan2;

                            total_diemtuchamlinhvuc += tieuchithanhphan.diemtuchamlan1;
                            total_diemthamdinhlinhvuc += tieuchithanhphan.diemthamdinhlan1;
                            total_diemthamdinhlinhvuclan2 += tieuchithanhphan.diemthamdinhlan2;
                        };


                    };

                    data_linhvuc.push({
                        linhvuc: {
                            text: i.linhvuc.text,
                            diemtoida: i.linhvuc.diemtoida,
                            thutu: i.linhvuc.thutu,
                            diemtucham: total_diemtuchamlinhvuc,
                            diemthamdinhlan1: total_diemthamdinhlinhvuc,
                            diemthamdinhlan2: total_diemthamdinhlinhvuclan2
                        },
                        _id: i._id
                    })

                };
                data.push({
                    user: item.taikhoan.tenhienthi,
                    linhvuc_group: data_linhvuc
                })
            };
            res.status(200).json({ data, linhvucList: phieucham.phieuchamdiem.map(e => ({ linhvuc: e.linhvuc, _id: e._id })) })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },
    xepHangTheoTieuchi: async (req, res) => {
        let { year, id_user, nhom } = req.query;
        // console.log(req.query)
          const schema = Joi.object({
                year: Joi.string().required(),
                id_user: Joi.string().required(),
                nhom: Joi.string().required(),
              });
        
              const { error, value } = schema.validate({
                year: year,
                id_user: id_user,
                nhom
              });
              if (error) {
                return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
              };
        try {
            let check_nam_cham_diem_used = await QuantriNamChamdiem.findOne({ user_created: value.id_user, nam: value.year })
            if (check_nam_cham_diem_used === null) {
                return res.status(401).json({ message: "Chưa có cuộc chấm điểm năm " + year })
            };
            let x = check_nam_cham_diem_used.setting.find(e => e.nhom === value.nhom);

            let id_phieucham = x.phieucham;
            // let phieucham = await PhieudiemNew.findById(id_phieucham);
            let items = await Phieuchamdiems.find({ year: value.year, phieuchamdiem: id_phieucham }).populate('taikhoan', { _id: 1, tenhienthi: 1 })
            // console.log(phieucham)
            // console.log(items)
            let tieuchiList = [];
            let data = []
            for (let item of items) {
                // console.log(item)
                let list = item.phieuchamdiem_detail;
                let data_tieuchi = []
                for (let i of list) {
                    for (let tieuchi of i.tieuchi_group) {
                        let total_diemtuchamtieuchi = 0;
                        let total_diemthamdinhtieuchi = 0;
                        let total_diemthamdinhtieuchilan2 = 0;


                        //lọc qua từng tiêu chí thành phần để tính điểm của tiêu chí
                        for (let tieuchithanhphan of tieuchi.tieuchithanhphan_group) {
                            total_diemtuchamtieuchi += tieuchithanhphan.diemtuchamlan1;
                            total_diemthamdinhtieuchi += tieuchithanhphan.diemthamdinhlan1;
                            total_diemthamdinhtieuchilan2 += tieuchithanhphan.diemthamdinhlan2;
                        };

                        data_tieuchi.push({
                            tieuchi: {
                                text: tieuchi.tieuchi.text,
                                diemtoida: tieuchi.tieuchi.diemtoida,
                                thutu: tieuchi.tieuchi.thutu,
                                diemtucham: total_diemtuchamtieuchi,
                                diemthamdinhlan1: total_diemthamdinhtieuchi,
                                diemthamdinhlan2: total_diemthamdinhtieuchilan2
                            },
                            _id: i._id
                        })
                    };



                };
                // console.log(data_tieuchi)
                data.push({
                    user: item.taikhoan.tenhienthi,
                    tieuchi_group: data_tieuchi
                });

                tieuchiList = data_tieuchi.map(i => ({
                    _id: i._id,
                    value: i.tieuchi.text
                }))
            };
            res.status(200).json({ data, linhvucList: tieuchiList })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }
    },

    checkImportUser: async (req, res) => {
        let { data } = req.body;
        let userId = req.userId.userId;
        let nhom_list = [];
        let user;
        try {
            user = await Users.findOne({ _id: userId });
            let check_cap = user.taikhoancap;
            // console.log(check_cap)
            if (check_cap === "Cấp Bộ") {
                nhom_list = [
                    "Các đơn vị thuộc cơ quan Bộ có chức năng giải quyết TTHC cho cá nhân, tổ chức",
                    "Các đơn vị thuộc cơ quan Bộ không có chức năng giải quyết TTHC cho cá nhân, tổ chức",
                    "Công an cấp tỉnh"
                ]
            };
            if (check_cap === "Cấp Tỉnh") {
                nhom_list = [
                    "Phòng có chức năng giải quyết thủ tục hành chính",
                    "Phòng không có chức năng giải quyết thủ tục hành chính",
                    "Cấp Xã"
                ]
            };
        } catch (error) {
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
        }

        try {
            let i = 1;
            let err = false;
            let text = "";
            let id_list = [];

            for (let item of data) {
                let item_db = {
                    ...item,
                    matkhau: "123456",
                    status: true, capcha: user._id,
                    block_by_admin: false,
                    time_block: new Date()
                };

                const validation = new Users(item_db);
                // await validation.save()
                id_list.push(validation._id);
                try {
                    await validation.validate() //kiểm tra xem có hợp lệ với model hay không
                    // console.log(user)
                    //check field taikhoancap. nếu được thêm từ cấp Bộ thì taikhoancap = Cấp Bộ || Cấp Tỉnh || Cấp Cục
                    // Cấp Tỉnh thì taikhoancap là Cấp Phòng, Cấp Xã
                    if (user.taikhoancap === "Cấp Bộ") {
                        let check_taikhoancap = item.taikhoancap === "Cấp Cục" || item.taikhoancap === "Cấp Tỉnh";
                        // console.log(check_taikhoancap)
                        if (!check_taikhoancap) {
                            err = true;
                            text = 'Dữ liệu không hợp lệ tại dòng thứ ' + i + ". Trường captaikhoan không hợp lệ. Vui lòng kiểm tra lại."
                            break;
                        };

                    };
                    if (user.taikhoancap === "Cấp Tỉnh") {
                        let check_taikhoancap = item.taikhoancap === "Cấp Phòng" || item.taikhoancap === "Cấp Xã";
                        if (!check_taikhoancap) {
                            err = true;
                            text = 'Dữ liệu không hợp lệ tại dòng thứ ' + i + ". Trường captaikhoan không hợp lệ. Vui lòng kiểm tra lại."
                            break;
                        };

                    };

                    //check nhóm theo chức năng chấm điểm của tài khoản

                    let check_nhom = nhom_list.includes(item.nhom);
                    if (!check_nhom) {
                        err = true;
                        text = 'Dữ liệu không hợp lệ tại dòng thứ ' + i + ". Trường nhom không hợp lệ. Vui lòng kiểm tra lại."
                        break;
                    };

                    i++;
                    await validation.save()

                } catch (error) {
                    let x = error.message
                    if (error.message.includes("E11000 duplicate key error collection: chamdiemcaicachBCA.users index")) {
                        x = error.message.replace('Chi tiết lỗi: E11000 duplicate key error collection: chamdiemcaicachBCA.users index', "Trùng giá trị đưa vào hệ thống tại trường:")
                    }
                    // console.error('Dữ liệu không hợp lệ tại dòng thứ ' + i +". Vui lòng kiểm tra lại file import theo đúng cấu trúc", error.message);
                    err = true;
                    text = 'Dữ liệu không hợp lệ tại dòng thứ ' + i + ". Vui lòng kiểm tra lại file import theo đúng cấu trúc" + x;
                    await Users.deleteMany({
                        _id: { $in: id_list }
                    });
                    break;
                }
            };

            if (err) {
                await Users.deleteMany({
                    _id: { $in: id_list }
                });
                return res.status(401).json({ status: "failed", message: "Import dữ liệu thất bại. Chi tiết lỗi: " + text });
            };
            await saveAction(req.userId.userId, `Import danh sách tài khoản`)
            res.status(200).json({ message: "Import dữ liệu thành công!" })
        } catch (error) {
            console.log("lỗi: ", error.message);
            res.status(401).json({ status: "failed", message: "Có lỗi xảy ra. Vui lòng kiểm tra lại file import hoặc liên hệ quản trị hệ thống" });
        }
    },
};
