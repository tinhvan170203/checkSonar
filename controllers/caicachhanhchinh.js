
const Phieuchamdiems = require("../models/Phieuchamdiem");
const Joi = require('joi');
const path = require('path');
const docx = require("docx");
const { Document, Packer, Paragraph, convertInchesToTwip, WidthType, TextRun, AlignmentType, PageSize, PageOrientation, Table, TableCell, TableRow, VerticalAlign, TextDirection, HeadingLevel } = docx;
const fs = require("fs");
const Users = require("../models/Users");
const HistoriesSystem = require("../models/HistoriesSystem");
const QuantriNamChamdiem = require("../models/QuanlyNamChamdiem");
const PhieudiemNew = require("../models/PhieudiemNew");
const sanitize = require('sanitize-filename');
/*Hàm tính khoảng cách giữa 2 ngày trong javascript*/
const get_day_of_time = (d1, d2) => {
  let date1 = new Date(d1);
  let date2 = new Date(d2);
  let ms1 = date1.getTime();
  let ms2 = date2.getTime();
  return Math.ceil((ms2 - ms1) / (24 * 60 * 60 * 1000));
};
const convert_range_time_format = (date) => {
  // Định nghĩa hai thời điểm
  let startDate = new Date(); // Thời gian hiện tại

  let endDate = new Date(date); // Ngày kết thúc

  // Tính khoảng cách tính bằng mili giây
  let timeDiff = endDate - startDate;
  // timeDiff = Math.abs(timeDiff)
  // console.log(timeDiff)
  // Chuyển đổi mili giây thành các đơn vị thời gian
  // đổi sang giá trị tuyệt đối để tính số ngày, giò còn lại
  let timeDiff_abs = Math.abs(timeDiff)
  let seconds = Math.floor(timeDiff_abs / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);
  // console.log(hours)
  // Tính số giờ, phút, giây còn lại , chia lấy phần dư
  let remainingHours = hours % 24;
  let remainingMinutes = minutes % 60;
  let remainingSeconds = seconds % 60;

  return {
    timeDiff,
    days,
    remainingHours,
    remainingMinutes,
    remainingSeconds
  }
};

const saveAction = async (user_id, action) => {
  let newAction = new HistoriesSystem({
    user: user_id,
    action: action
  })
  await newAction.save();
};

module.exports = {
  //tạo mới bảng điểm tự chấm
  // cần phân biệt tài khoản cấp xã và cấp phòng
  handleChangeSelectNam: async (req, res) => {
    let { year } = req.query;
    // year = Number(year)
    try {
      let user = await Users.findById(req.params.id);
      // console.log(user)
      let id_capcha = user.capcha;
      const schema = Joi.object({
        year: Joi.string().required(),
        id: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        year: year,
        id: req.params.id
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
      // console.log(id_capcha)
      //kiểm tra xem cuộc chấm điểm trong năm đó được tạo bới tài khoản cấp trên hay không
      let checked_namchamdiem = await QuantriNamChamdiem.findOne({
        nam: value.year,
        user_created: id_capcha
      });
      // console.log(checked_namchamdiem)
      if (!checked_namchamdiem) {
        return res.status(401).json({ message: "Thông báo: Cơ quan cấp trên chưa tạo bảng chấm điểm năm " + year + ". Vui lòng liên hệ với cơ quan cấp trên" })
      } else {
        let item = await Phieuchamdiems.findOne({ year: value.year, taikhoan: value.id }).populate('phieuchamdiem');
        //TH chưa có phiếu chấm điểm thì tạo 1 bản chấm điểm mới của tài khoản
        if (!item) {
          let setting = checked_namchamdiem.setting;
          let nhom_user = user.nhom;
          let index = setting.findIndex(i => i.nhom === nhom_user);
          let id_phieucham = setting[index].phieucham;
          let nhomchucnang = setting[index].nhom;
          let phieucham = await PhieudiemNew.findById(id_phieucham);

          let phieuchamdiem_detail = [...phieucham.phieuchamdiem];
          let data = [];


          let dulieu = {
            year: year,
            chotdiemtucham: {
              status: false,
              files: [],
              time: null
            },
            chotdiemgiaitrinh: {
              status: false,
              files: [],
              time: null
            },
            diemthuongtoida: checked_namchamdiem.diemthuongtoida,
            diemphattoida: checked_namchamdiem.diemphattoida,
            taikhoan: req.params.id,
            phieuchamdiem: id_phieucham,
            phieuchamdiem_detail: phieuchamdiem_detail,
            diemthuong: 0,
            diemthuongthamdinhlan2: 0,
            diemphat: 0,
            diemphatthamdinhlan2: 0,
            diemthuongtucham: 0,
            diemphattucham: 0,
            ghichudiemthuong: {
              ghichucuadonvi: "",
              ghichucuathamdinh: "",
              files: []
            },
            ghichudiemthuonggiaitrinh: {
              ghichucuadonvi: "",
              ghichucuathamdinh: "",
              files: []
            },
            ghichudiemphat: {
              ghichucuadonvi: "",
              ghichucuathamdinh: "",
              files: []
            },
            ghichudiemphatgiaitrinh: {
              ghichucuadonvi: "",
              ghichucuathamdinh: "",
              files: []
            },
            yeucaugiaitrinhdiemthuong: false,
            yeucaugiaitrinhdiemphat: false,
            nhomchucnang
          };

          let newItem = new Phieuchamdiems(dulieu);
          let list = newItem.phieuchamdiem_detail;

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

            data.push({
              linhvuc: {
                text: i.linhvuc.text,
                diemtoida: i.linhvuc.diemtoida,
                thutu: i.linhvuc.thutu,
                diemtucham: total_diemtuchamlinhvuc,
                diemthamdinhlan1: total_diemthamdinhlinhvuc,
                diemthamdinhlan2: total_diemthamdinhlinhvuclan2
              },
              _id: i._id,
              tieuchi_group: tieuchiList,
            })
          };

          (await newItem.save());
          //  console.log(item)
          let item = await Phieuchamdiems.findById(newItem._id).populate('phieuchamdiem')
          await saveAction(req.userId.userId, `Tạo mới bảng điểm tự chấm năm ${year}`)
          let phieuchamNew = {
            ...item._doc,
            phieuchamdiem_detail: data
          };

          //check hạn tự chấm điểm
          let check_han_cham_diem = checked_namchamdiem.thoigianhethantuchamdiem;
          let { timeDiff, days, remainingHours, remainingMinutes } = convert_range_time_format(check_han_cham_diem) // tính ra khoảng cách thời gian còn hạn tự chấm hay không

          let time_den_han = "";
          let checkDateChamdiem = false; // biến xem thời hạn tự chấm điểm còn không
          if (timeDiff < 0) {
            checkDateChamdiem = true; // đã qua hạn tự chấm điểm
            time_den_han = "Đã qua hạn tự chấm điểm"
          } else {
            if (days > 0) {
              time_den_han = `${days} ngày ${remainingHours} giờ ${remainingMinutes} phút`
            } else {
              time_den_han = `${remainingHours} giờ ${remainingMinutes} phút`
            }
          }

          res.status(200).json({
            phieuchamdiem: phieuchamNew,
            checkDateChamdiem,
            checked_namchamdiem,
            time_den_han
          })
        } else {
          let data = [];
          let list = item.phieuchamdiem_detail;

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

            data.push({
              linhvuc: {
                text: i.linhvuc.text,
                diemtoida: i.linhvuc.diemtoida,
                thutu: i.linhvuc.thutu,
                diemtucham: total_diemtuchamlinhvuc,
                diemthamdinhlan1: total_diemthamdinhlinhvuc,
                diemthamdinhlan2: total_diemthamdinhlinhvuclan2
              },
              _id: i._id,
              tieuchi_group: tieuchiList,
            })
          };

          let phieuchamNew = {
            ...item._doc,
            phieuchamdiem_detail: data
          };

          let check_han_cham_diem = checked_namchamdiem.thoigianhethantuchamdiem;
          let { timeDiff, days, remainingHours, remainingMinutes } = convert_range_time_format(check_han_cham_diem) // tính ra khoảng cách thời gian còn hạn tự chấm hay không

          let time_den_han = "";
          let checkDateChamdiem = false; // biến xem thời hạn tự chấm điểm còn không
          if (timeDiff < 0) {
            checkDateChamdiem = true; // đã qua hạn tự chấm điểm
            time_den_han = "Đã qua hạn tự chấm điểm"
          } else {
            if (days > 0) {
              time_den_han = `${days} ngày ${remainingHours} giờ ${remainingMinutes} phút`
            } else {
              time_den_han = `${remainingHours} giờ ${remainingMinutes} phút`
            }
          }

          res.status(200).json({
            phieuchamdiem: phieuchamNew,
            checkDateChamdiem,
            checked_namchamdiem,
            time_den_han
          })
        };
      };
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  saveUploadtailieu: async (req, res) => {
    let { id_linhvuc, id_tieuchi, filesSaved, filesDelete, id_tieuchithanhphan, ghichucuadonvi } = req.body;
    // console.log(id_linhvuc)
    try {
      //xóa bỏ các file cần xóa, gộp các file giữ lại + thêm mới 
      let { id_phieucham } = req.params;
      //files đính kèm của từng tiêu chí
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);
      let text = "";
      let text1 = "";

      if (files.length > 0) {
        text = "Thêm mới các file " + files.toString();
      };

      if (filesDelete.length > 0) {
        text1 = " Xóa các file tài liệu " + filesDelete.toString();
      };
      text = text + text1;

      // for (i of filesDelete) {
      //   let path_delete = path.join(__dirname, `../upload/${req.userId.userId}/` + i);
      //   if (fs.existsSync(path_delete)) {
      //     fs.unlinkSync(path.join(__dirname, `../upload/${req.userId.userId}/` + i));
      //     console.log(`The file ${path_delete} exists.`);
      //   } else {
      //     console.log(`The file ${path_delete} does not exist.`);
      //   }
      // }
      for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }

      files = JSON.parse(filesSaved).concat(files);
      let phieucham = await Phieuchamdiems.findById(id_phieucham)

      let phieuchamdiem_detail = [...phieucham.phieuchamdiem_detail];
      phieuchamdiem_detail = phieuchamdiem_detail.map(detail => {
        if (detail._id.toString() === id_linhvuc) {
          return {
            ...detail,
            tieuchi_group: detail.tieuchi_group.map(tieuchi => {
              if (tieuchi._id.toString() === id_tieuchi) {
                return {
                  ...tieuchi,
                  tieuchithanhphan_group: tieuchi.tieuchithanhphan_group.map(tieuchithanhphan => {
                    if (tieuchithanhphan._id.toString() === id_tieuchithanhphan) {
                      return {
                        ...tieuchithanhphan,
                        ghichucuadonvilan1: ghichucuadonvi,
                        files: files
                      }
                    } else {
                      return { ...tieuchithanhphan }
                    }
                  })
                }
              } else {
                return { ...tieuchi }
              }
            })
          }
        } else {
          return detail
        }
      })
      await Phieuchamdiems.findByIdAndUpdate(id_phieucham, {
        phieuchamdiem_detail
      });

      await saveAction(req.userId.userId, `Lưu tài liệu kiểm chứng "${text}" và ghi chú của đơn vị: "${ghichucuadonvi}"`)
      res.status(200).json({ message: "Lưu tài liệu kiểm chứng thành công", files: files, ghichucuadonvi, id_linhvuc, id_tieuchi, id_tieuchithanhphan })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  downloadFile: async (req, res) => {
    let file = req.params.file;
    let { id_user } = req.query;
    let path_file = path.join(
      __dirname,
      `../upload/${id_user}/` + file
    );
    res.download(path_file, file, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Tải file xuống thành công");
      }
    });
  },

  saveUploadtailieuGiaitrinh: async (req, res) => {
    let { id_linhvuc, id_tieuchi, filesSaved, filesDelete, id_tieuchithanhphan, ghichucuadonvi } = req.body;
    // console.log(id_linhvuc)
    try {
      //xóa bỏ các file cần xóa, gộp các file giữ lại + thêm mới 
      let { id_phieucham } = req.params;
      //files đính kèm của từng tiêu chí
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);
      let text = "";
      let text1 = "";

      if (files.length > 0) {
        text = "Thêm mới các file " + files.toString();
      };

      if (filesDelete.length > 0) {
        text1 = " Xóa các file tài liệu " + filesDelete.toString();
      };
      text = text + text1;

      for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }

      files = JSON.parse(filesSaved).concat(files);
      let phieucham = await Phieuchamdiems.findById(id_phieucham)

      let phieuchamdiem_detail = [...phieucham.phieuchamdiem_detail];
      phieuchamdiem_detail = phieuchamdiem_detail.map(detail => {
        if (detail._id.toString() === id_linhvuc) {
          return {
            ...detail,
            tieuchi_group: detail.tieuchi_group.map(tieuchi => {
              if (tieuchi._id.toString() === id_tieuchi) {
                return {
                  ...tieuchi,
                  tieuchithanhphan_group: tieuchi.tieuchithanhphan_group.map(tieuchithanhphan => {
                    if (tieuchithanhphan._id.toString() === id_tieuchithanhphan) {
                      return {
                        ...tieuchithanhphan,
                        ghichucuadonvilan2: ghichucuadonvi,
                        files_bosung: files
                      }
                    } else {
                      return { ...tieuchithanhphan }
                    }
                  })
                }
              } else {
                return { ...tieuchi }
              }
            })
          }
        } else {
          return detail
        }
      })
      await Phieuchamdiems.findByIdAndUpdate(id_phieucham, {
        phieuchamdiem_detail
      });

      await saveAction(req.userId.userId, `Lưu tài liệu giải trình "${text}" và ghi chú của đơn vị: "${ghichucuadonvi}"`)
      res.status(200).json({ message: "Lưu tài liệu giải trình thành công", files: files, ghichucuadonvi, id_linhvuc, id_tieuchi, id_tieuchithanhphan })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  updateChamdiem: async (req, res) => {
    let { list, id_phieucham, diemthuongtucham, diemphattucham } = req.body;

    try {
      // console.log('dsada',data[0].tieuchi_group[0].tieuchithanhphan[0].diemtucham)
      let item = await Phieuchamdiems.findByIdAndUpdate(id_phieucham, {
        phieuchamdiem_detail: list,
        diemthuongtucham,
        diemphattucham
      });

      await saveAction(req.userId.userId, `Cập nhật bảng điểm tự chấm năm ${item.year}`)
      res.status(200).json({ message: "Cập nhật điểm tự chấm thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  // createDocx: async (req, res) => {
  //   let { idPhieucham, nam } = req.query;
  //   // console.log(req.query)
  //   try {
  //     // console.log('11',item)
  //     let item = await Phieuchamdiems.findById(idPhieucham).populate('phieuchamdiem.linhvuc').populate('phieuchamdiem.tieuchi_group.tieuchi').populate('phieuchamdiem.tieuchi_group.tieuchithanhphan.tieuchithanhphan').populate('taikhoan');
  //     let taikhoan = await Users.findById(item.taikhoan);
  //     // console.log(taikhoan)
  //     let cap = taikhoan.taikhoancap[0];
  //     // console.log(cap)
  //     let data = [];
  //     let list = item.phieuchamdiem;
  //     // console.log(list[0].tieuchi_group[0].tieuchithanhphan)
  //     let total_diemtoida = 0;
  //     let total_diemtucham = 0;
  //     let total_diemthamdinh = 0;

  //     for (let i of list) {
  //       let tieuchi_group = i.tieuchi_group;
  //       let tieuchiList = [];
  //       let total_diemtuchamlinhvuc = 0;
  //       let total_diemthamdinhlinhvuc = 0;
  //       if (cap === "xã") {
  //         total_diemtoida += i.linhvuc.diemtoidacapxa;
  //       } else if (cap === "huyện") {
  //         total_diemtoida += i.linhvuc.diemtoidacaphuyen;
  //       } else {
  //         total_diemtoida += i.linhvuc.diemtoida;
  //       }


  //       for (let tieuchi of tieuchi_group) {
  //         let total_diemtuchamtieuchi = 0;
  //         let total_diemthamdinhtieuchi = 0;


  //         let tieuchithanhphan = [];
  //         // console.log(tieuchi.tieuchithanhphan[1])
  //         if (cap === "xã") { //TH cấp xã
  //           tieuchithanhphan = tieuchi.tieuchithanhphan.map(e => ({
  //             tentieuchi: e.tieuchithanhphan.tentieuchi,
  //             diemtoida: e.tieuchithanhphan.diemtoidacapxa,
  //             phanloaidanhgia: e.tieuchithanhphan.phanloaidanhgiacapxa,
  //             diemtucham: e.diemtucham,
  //             diemtucho: e.tieuchithanhphan.diemtucho,
  //             ghichu: e.tieuchithanhphan.ghichu,
  //             diemthamdinh: e.diemthamdinh,
  //             ghichucuadonvi: e.ghichucuadonvi,
  //             ghichucuathamdinh: e.ghichucuathamdinh,
  //             files: e.files,
  //             _id: e.tieuchithanhphan._id,
  //           }));

  //           // console.log('xã nè')

  //           tieuchithanhphan = tieuchithanhphan.map(el => {
  //             let phanloaidanhgia = el.phanloaidanhgia.filter(x => x.status === true)
  //             return { ...el, phanloaidanhgia }
  //           });
  //         } else if (cap === "huyện") {
  //           tieuchithanhphan = tieuchi.tieuchithanhphan.map(e => ({
  //             tentieuchi: e.tieuchithanhphan.tentieuchi,
  //             diemtoida: e.tieuchithanhphan.diemtoidacaphuyen,
  //             phanloaidanhgia: e.tieuchithanhphan.phanloaidanhgiacaphuyen,
  //             diemtucham: e.diemtucham,
  //             diemtucho: e.tieuchithanhphan.diemtucho,
  //             ghichu: e.tieuchithanhphan.ghichu,
  //             diemthamdinh: e.diemthamdinh,
  //             ghichucuadonvi: e.ghichucuadonvi,
  //             ghichucuathamdinh: e.ghichucuathamdinh,
  //             files: e.files,
  //             _id: e.tieuchithanhphan._id,
  //           }));

  //           // console.log('xã nè')

  //           tieuchithanhphan = tieuchithanhphan.map(el => {
  //             let phanloaidanhgia = el.phanloaidanhgia.filter(x => x.status === true)
  //             return { ...el, phanloaidanhgia }
  //           });
  //         } else {
  //           tieuchithanhphan = tieuchi.tieuchithanhphan.map(e => ({
  //             tentieuchi: e.tieuchithanhphan.tentieuchi,
  //             diemtoida: e.tieuchithanhphan.diemtoida,
  //             phanloaidanhgia: e.tieuchithanhphan.phanloaidanhgia,
  //             diemtucham: e.diemtucham,
  //             diemtucho: e.tieuchithanhphan.diemtucho,
  //             ghichu: e.tieuchithanhphan.ghichu,
  //             diemthamdinh: e.diemthamdinh,
  //             ghichucuadonvi: e.ghichucuadonvi,
  //             ghichucuathamdinh: e.ghichucuathamdinh,
  //             files: e.files,
  //             _id: e.tieuchithanhphan._id,
  //           }));

  //           tieuchithanhphan = tieuchithanhphan.map(el => {
  //             let phanloaidanhgia = el.phanloaidanhgia.filter(x => x.status === true)
  //             return { ...el, phanloaidanhgia }
  //           });

  //         };


  //         tieuchithanhphan.forEach(el => {
  //           total_diemtuchamtieuchi += el.diemtucham
  //           total_diemthamdinhtieuchi += el.diemthamdinh
  //         })

  //         // console.log(tieuchi)
  //         tieuchiList.push({
  //           tieuchi: { diemtucham: total_diemtuchamtieuchi, diemthamdinh: total_diemthamdinhtieuchi, ...tieuchi.tieuchi._doc },
  //           tieuchithanhphan
  //         }
  //         );

  //         // console.log(tieuchiList)

  //         total_diemthamdinhlinhvuc += total_diemthamdinhtieuchi
  //         total_diemtuchamlinhvuc += total_diemtuchamtieuchi
  //       };

  //       data.push({
  //         linhvuc: { ...i.linhvuc._doc, diemtucham: total_diemtuchamlinhvuc, diemthamdinh: total_diemthamdinhlinhvuc },
  //         tieuchi_group: tieuchiList,
  //       })
  //     };

  //     let children_list = [];
  //     let index = 1;



  //     //thead cua table
  //     children_list = children_list.concat(
  //       new TableRow({
  //         children: [
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "STT", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1000,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Tiêu chí", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             },
  //             width: {
  //               size: 2000,
  //               type: WidthType.DXA,
  //             },
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Điểm tối đa", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Điểm tự chấm", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Điểm thẩm định", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Ghi chú của đơn vị", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             // width: {
  //             //   size: 2000,
  //             //   type: WidthType.DXA,
  //             // },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Ghi chú của thẩm định", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 2000,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),

  //         ],
  //       }),
  //     );


  //     for (let element of data) {
  //       total_diemtucham += element.linhvuc.diemtucham;
  //       total_diemthamdinh += element.linhvuc.diemthamdinh;

  //       if (cap === "xã") {
  //         children_list = children_list.concat(
  //           new TableRow({
  //             children: [
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: `${index}`, size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.tenlinhvuc.toUpperCase(), size: 26, bold: true })
  //                   ],
  //                   // alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemtoidacapxa.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: "", size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 2000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: "", size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 2000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //             ]
  //           })
  //         );
  //         let index_tieuchi = 1;

  //         for (let tieuchi of element.tieuchi_group) {

  //           children_list = children_list.concat(
  //             new TableRow({
  //               children: [
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: `${index}.${index_tieuchi}`, size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.tentieuchi, size: 26, })
  //                     ],
  //                     // alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemtoidacapxa.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: "", size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 2000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: "", size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 2000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //               ]
  //             })
  //           );


  //           let index_tieuchithanhphan = 1;
  //           for (let tieuchithanhphan of tieuchi.tieuchithanhphan) {

  //             children_list = children_list.concat(
  //               new TableRow({
  //                 children: [
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: `${index}.${index_tieuchi}.${index_tieuchithanhphan}`, size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     width: {
  //                       size: 1000,
  //                       type: WidthType.DXA,
  //                     },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.tentieuchi, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemtoida.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.ghichucuadonvi, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 2000,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.ghichucuathamdinh, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 2000,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                 ]
  //               })
  //             )
  //             index_tieuchithanhphan += 1;
  //           }
  //           index_tieuchi += 1;
  //         }

  //         index += 1;
  //       } else if (cap === "huyện") {
  //         children_list = children_list.concat(
  //           new TableRow({
  //             children: [
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: `${index}`, size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.tenlinhvuc.toUpperCase(), size: 26, bold: true })
  //                   ],
  //                   // alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemtoidacaphuyen.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: "", size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 2000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: "", size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 2000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //             ]
  //           })
  //         );
  //         let index_tieuchi = 1;

  //         for (let tieuchi of element.tieuchi_group) {

  //           children_list = children_list.concat(
  //             new TableRow({
  //               children: [
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: `${index}.${index_tieuchi}`, size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.tentieuchi, size: 26, })
  //                     ],
  //                     // alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemtoidacaphuyen.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: "", size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 2000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: "", size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 2000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //               ]
  //             })
  //           );


  //           let index_tieuchithanhphan = 1;
  //           for (let tieuchithanhphan of tieuchi.tieuchithanhphan) {

  //             children_list = children_list.concat(
  //               new TableRow({
  //                 children: [
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: `${index}.${index_tieuchi}.${index_tieuchithanhphan}`, size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     width: {
  //                       size: 1000,
  //                       type: WidthType.DXA,
  //                     },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.tentieuchi, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemtoida.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.ghichucuadonvi, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 2000,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.ghichucuathamdinh, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 2000,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                 ]
  //               })
  //             )
  //             index_tieuchithanhphan += 1;
  //           }
  //           index_tieuchi += 1;
  //         }

  //         index += 1;
  //       } else {
  //         children_list = children_list.concat(
  //           new TableRow({
  //             children: [
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: `${index}`, size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1000,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.tenlinhvuc.toUpperCase(), size: 26, bold: true })
  //                   ],
  //                   // alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemtoida.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: element.linhvuc.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 width: {
  //                   size: 1200,
  //                   type: WidthType.DXA,
  //                 },
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: "", size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //               new TableCell({
  //                 children: [new Paragraph({
  //                   children: [
  //                     new TextRun({ text: "", size: 26, bold: true })
  //                   ],
  //                   alignment: AlignmentType.CENTER
  //                 })],
  //                 verticalAlign: VerticalAlign.CENTER,
  //                 margins: {
  //                   top: 30,
  //                   bottom: 30,
  //                 }
  //               }),
  //             ]
  //           })
  //         );
  //         let index_tieuchi = 1;

  //         for (let tieuchi of element.tieuchi_group) {

  //           children_list = children_list.concat(
  //             new TableRow({
  //               children: [
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: `${index}.${index_tieuchi}`, size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1000,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.tentieuchi, size: 26, })
  //                     ],
  //                     // alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemtoida.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: tieuchi.tieuchi.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   width: {
  //                     size: 1200,
  //                     type: WidthType.DXA,
  //                   },
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: "", size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //                 new TableCell({
  //                   children: [new Paragraph({
  //                     children: [
  //                       new TextRun({ text: "", size: 26, bold: true })
  //                     ],
  //                     alignment: AlignmentType.CENTER
  //                   })],
  //                   verticalAlign: VerticalAlign.CENTER,
  //                   margins: {
  //                     top: 30,
  //                     bottom: 30,
  //                   }
  //                 }),
  //               ]
  //             })
  //           );


  //           let index_tieuchithanhphan = 1;
  //           for (let tieuchithanhphan of tieuchi.tieuchithanhphan) {

  //             children_list = children_list.concat(
  //               new TableRow({
  //                 children: [
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: `${index}.${index_tieuchi}.${index_tieuchithanhphan}`, size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     width: {
  //                       size: 1000,
  //                       type: WidthType.DXA,
  //                     },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.tentieuchi, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemtoida.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemtucham.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.diemthamdinh.toFixed(2).toString(), size: 26, bold: true })
  //                       ],
  //                       alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     // width: {
  //                     //   size: 1200,
  //                     //   type: WidthType.DXA,
  //                     // },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.ghichucuadonvi, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     width: {
  //                       size: 2000,
  //                       type: WidthType.DXA,
  //                     },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                   new TableCell({
  //                     children: [new Paragraph({
  //                       children: [
  //                         new TextRun({ text: tieuchithanhphan.ghichucuathamdinh, size: 26 })
  //                       ],
  //                       // alignment: AlignmentType.CENTER
  //                     })],
  //                     verticalAlign: VerticalAlign.CENTER,
  //                     width: {
  //                       size: 2000,
  //                       type: WidthType.DXA,
  //                     },
  //                     margins: {
  //                       top: 30,
  //                       bottom: 30,
  //                     }
  //                   }),
  //                 ]
  //               })
  //             )
  //             index_tieuchithanhphan += 1;
  //           }
  //           index_tieuchi += 1;
  //         }

  //         index += 1;
  //       };


  //     };

  //     // console.log(total_diemthamdinh, total_diemtoida, total_diemthamdinh)
  //     children_list = children_list.concat(
  //       new TableRow({
  //         children: [
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1000,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Điểm thưởng", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.diemthuongtucham.toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.diemthuong.toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.ghichudiemthuong.ghichucuadonvi, size: 26 })
  //               ],
  //               // alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.ghichudiemthuong.ghichucuathamdinh, size: 26 })
  //               ],
  //               // alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),

  //         ],
  //       }),
  //     );
  //     children_list = children_list.concat(
  //       new TableRow({
  //         children: [
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1000,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Điểm phạt", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.diemphattucham.toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.diemphat.toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.ghichudiemphat.ghichucuadonvi, size: 26 })
  //               ],
  //               // alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: item.ghichudiemphat.ghichucuathamdinh, size: 26 })
  //               ],
  //               // alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),

  //         ],
  //       }),
  //     );
  //     children_list = children_list.concat(
  //       new TableRow({
  //         children: [
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1000,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "Tổng cộng", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: total_diemtoida.toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: (total_diemtucham + item.diemthuongtucham - item.diemphattucham).toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: (total_diemthamdinh + item.diemthuong - item.diemphat).toFixed(2).toString(), size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             width: {
  //               size: 1200,
  //               type: WidthType.DXA,
  //             },
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),
  //           new TableCell({
  //             children: [new Paragraph({
  //               children: [
  //                 new TextRun({ text: "", size: 26, bold: true })
  //               ],
  //               alignment: AlignmentType.CENTER
  //             })],
  //             verticalAlign: VerticalAlign.CENTER,
  //             margins: {
  //               top: 30,
  //               bottom: 30,
  //             }
  //           }),

  //         ],
  //       }),
  //     );

  //     const doc = new Document({
  //       properties: {
  //       },
  //       sections: [{
  //         properties: {
  //           page: {
  //             size: {
  //               orientation: PageOrientation.LANDSCAPE,
  //             },
  //             margin: {
  //               top: 700,
  //               right: 700,
  //               bottom: 700,
  //               left: 1000,
  //             }
  //           },
  //         },
  //         children: [
  //           new Paragraph({
  //             alignment: AlignmentType.CENTER,
  //             children: [
  //               new TextRun({ text: "BẢNG CHẤM ĐIỂM CHỈ SỐ CẢI CÁCH HÀNH CHÍNH", size: 28 }),
  //             ],

  //           }),
  //           new Paragraph({
  //             alignment: AlignmentType.CENTER,
  //             children: [
  //               new TextRun({ text: `Đơn vị: ${item.taikhoan.tenhienthi} - Năm ${nam}`, size: 28 }),
  //             ],
  //           }),
  //           new Paragraph({
  //             alignment: AlignmentType.CENTER,
  //             children: [
  //               new TextRun({ text: "", size: 28 }),
  //             ],
  //           }),
  //           new Table({
  //             rows: children_list,
  //             // width: {
  //             //   size: 15500,
  //             //   type: WidthType.DXA,
  //             // },
  //             margins: {
  //               top: 60
  //             }
  //           })
  //         ],
  //       }]

  //     });

  //     Packer.toBuffer(doc).then((buffer) => {
  //       fs.writeFileSync(path.join(
  //         __dirname,
  //         "../" + `${item.taikhoan.tenhienthi}_chamdiemcaicachhanhchinh_${nam}.docx`
  //       ), buffer);
  //       // console.log('Table created successfully');
  //       let path_file = path.join(
  //         __dirname,
  //         "../" + `${item.taikhoan.tenhienthi}_chamdiemcaicachhanhchinh_${nam}.docx`
  //       );
  //       // console.log(path_file)
  //       res.download(path_file, `${item.taikhoan.tenhienthi}_chamdiemcaicachhanhchinh_${nam}.docx`, function (err) {
  //         if (err) {
  //           console.log(err);
  //         } else {
  //           fs.unlinkSync(path_file, `${item.taikhoan.tenhienthi}_chamdiemcaicachhanhchinh_${nam}.docx`);
  //         }
  //       });
  //     }).catch((error) => {
  //       console.error('Error creating table:', error);
  //     });

  //   } catch (error) {
  //     console.log(error.message)
  //   }
  // },

  checkedChotdiem: async (req, res) => {
    let { year, id_user } = req.query;
    try {
      const schema = Joi.object({
        year: Joi.string().required(),
        id_user: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        year: year,
        id_user: id_user
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
      let item = await Phieuchamdiems.findOne({ year: value.year, taikhoan: value.id_user });
      if (!item) {
        return res.status(401).json({ message: "Chưa có bảng tự chấm điểm trong hệ thống, thao tác chốt điểm tự chấm không thể thực hiện" })
      };
      // console.log(item)
      res.status(200).json({ data: item.chotdiemtucham, idPhieucham: item._id })
    } catch (error) {

    }
  },

  saveChotdiemtucham: async (req, res) => {
    // console.log(req.body)
    let { filesSaved, filesDelete } = req.body;
    try {
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);

     for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }

      files = JSON.parse(filesSaved).concat(files)
      // console.log(files)
      let id = req.params.id;
      // console.log(idphieucham)
      await Phieuchamdiems.findByIdAndUpdate(id, {
        chotdiemtucham: {
          status: true,
          files,
          time: new Date()
        }
      });

      await saveAction(req.userId.userId, `Chốt điểm tự chấm`)
      res.status(200).json({ message: "Chốt điểm tự chấm thành công", files: files })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  saveChotdiemGiaitrinh: async (req, res) => {
    // console.log(req.body)
    let { filesSaved, filesDelete } = req.body;
    try {
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);

    for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }

      files = JSON.parse(filesSaved).concat(files)
      // console.log(files)
      let id = req.params.id;
      // console.log(idphieucham)
      await Phieuchamdiems.findByIdAndUpdate(id, {
        chotdiemgiaitrinh: {
          status: true,
          files,
          time: new Date()
        }
      });

      await saveAction(req.userId.userId, `Chốt tài liệu phần giải trình`)
      res.status(200).json({ message: "Chốt giải trình thành công", files: files })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  fetchTaikhoanDiaphuong: async (req, res) => {
    try {
      let items = await Users.find({ role: "Quản trị tại đơn vị" });
      res.status(200).json(items)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  fetchBangchamthamdinh: async (req, res) => {
    let { year, taikhoan } = req.query;
    // console.log(req.query)
    year = Number(year)
   const schema = Joi.object({
        year: Joi.string().required(),
        taikhoan: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        year: year,
        taikhoan: taikhoan
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
    try {
      let item = await Phieuchamdiems.findOne({ year: value.year, taikhoan: value.taikhoan }).populate('phieuchamdiem')
      if (!item) {
        return res.status(400).json({ message: "Không có bảng điểm tự chấm của đơn vị trong hệ thống phần mềm." })
      };

      let checked_namchamdiem = await QuantriNamChamdiem.findOne({
        nam: value.year,
        user_created: item.phieuchamdiem.user_created
      });

      if (!checked_namchamdiem) {
        return res.status(401).json({ message: "Thông báo: Cơ quan cấp trên chưa tạo bảng chấm điểm năm " + year + ". Vui lòng liên hệ với cơ quan cấp trên" })
      }

      let data = [];
      let list = item.phieuchamdiem_detail;

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

        data.push({
          linhvuc: {
            text: i.linhvuc.text,
            diemtoida: i.linhvuc.diemtoida,
            thutu: i.linhvuc.thutu,
            diemtucham: total_diemtuchamlinhvuc,
            diemthamdinhlan1: total_diemthamdinhlinhvuc,
            diemthamdinhlan2: total_diemthamdinhlinhvuclan2
          },
          _id: i._id,
          tieuchi_group: tieuchiList,
        })
      };

      let phieuchamNew = {
        ...item._doc,
        phieuchamdiem_detail: data
      };

      let check_han_cham_diem = checked_namchamdiem.thoigianhethantuchamdiem;
      let { timeDiff, days, remainingHours, remainingMinutes } = convert_range_time_format(check_han_cham_diem) // tính ra khoảng cách thời gian còn hạn tự chấm hay không
      let time_den_han = "";
      let checkDateChamdiem = false; // biến xem thời hạn tự chấm điểm còn không
      if (timeDiff < 0) {
        checkDateChamdiem = true; // đã qua hạn tự chấm điểm
        time_den_han = "Đã qua hạn tự chấm điểm"
      } else {
        if (days > 0) {
          time_den_han = `${days} ngày ${remainingHours} giờ ${remainingMinutes} phút`
        } else {
          time_den_han = `${remainingHours} giờ ${remainingMinutes} phút`
        }
      }

      res.status(200).json({
        phieuchamdiem: phieuchamNew,
        checkDateChamdiem,
        checked_namchamdiem,
        time_den_han
      })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  updateGhichuthamdinh: async (req, res) => {
    let { id_linhvuc, id_tieuchi, id_tieuchithanhphan, ghichucuathamdinh } = req.body;
    // console.log(id_linhvuc)
    try {
      let { id } = req.params;
      // console.log(id)
      let phieucham = await Phieuchamdiems.findById(id).populate('taikhoan')
      // console.log(phieucham)
      let phieuchamdiem_detail = [...phieucham.phieuchamdiem_detail];
      phieuchamdiem_detail = phieuchamdiem_detail.map(detail => {
        if (detail._id.toString() === id_linhvuc) {
          return {
            ...detail,
            tieuchi_group: detail.tieuchi_group.map(tieuchi => {
              if (tieuchi._id.toString() === id_tieuchi) {
                return {
                  ...tieuchi,
                  tieuchithanhphan_group: tieuchi.tieuchithanhphan_group.map(tieuchithanhphan => {
                    if (tieuchithanhphan._id.toString() === id_tieuchithanhphan) {
                      return {
                        ...tieuchithanhphan,
                        ghichucuathamdinh1: ghichucuathamdinh,
                      }
                    } else {
                      return { ...tieuchithanhphan }
                    }
                  })
                }
              } else {
                return { ...tieuchi }
              }
            })
          }
        } else {
          return detail
        }
      })
      await Phieuchamdiems.findByIdAndUpdate(id, {
        phieuchamdiem_detail
      });
      await saveAction(req.userId.userId, `Lưu ghi chú thẩm định lần 1: "${ghichucuathamdinh}" đối với bảng điểm của ${phieucham.taikhoan.tenhienthi} năm ${phieucham.year}`)
      res.status(200).json({ message: "Lưu ghi chú thẩm định thành công", ghichucuathamdinh, id_linhvuc, id_tieuchi, id_tieuchithanhphan })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  updateGhichuthamdinhlan2: async (req, res) => {
    let { id_linhvuc, id_tieuchi, id_tieuchithanhphan, ghichucuathamdinh } = req.body;
    // console.log(id_linhvuc)
    try {
      let { id } = req.params;
      // console.log()
      let phieucham = await Phieuchamdiems.findById(id).populate('taikhoan')

      let phieuchamdiem_detail = [...phieucham.phieuchamdiem_detail];
      phieuchamdiem_detail = phieuchamdiem_detail.map(detail => {
        if (detail._id.toString() === id_linhvuc) {
          return {
            ...detail,
            tieuchi_group: detail.tieuchi_group.map(tieuchi => {
              if (tieuchi._id.toString() === id_tieuchi) {
                return {
                  ...tieuchi,
                  tieuchithanhphan_group: tieuchi.tieuchithanhphan_group.map(tieuchithanhphan => {
                    if (tieuchithanhphan._id.toString() === id_tieuchithanhphan) {
                      return {
                        ...tieuchithanhphan,
                        ghichucuathamdinh2: ghichucuathamdinh,
                      }
                    } else {
                      return { ...tieuchithanhphan }
                    }
                  })
                }
              } else {
                return { ...tieuchi }
              }
            })
          }
        } else {
          return detail
        }
      })
      await Phieuchamdiems.findByIdAndUpdate(id, {
        phieuchamdiem_detail
      });
      await saveAction(req.userId.userId, `Lưu ghi chú thẩm định sau khi giải trình: "${ghichucuathamdinh}" đối với bảng điểm của ${phieucham.taikhoan.tenhienthi} năm ${phieucham.year}`)
      res.status(200).json({ message: "Lưu ghi chú thẩm định thành công", ghichucuathamdinh, id_linhvuc, id_tieuchi, id_tieuchithanhphan })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  saveDiemthamdinh: async (req, res) => {
    let { list, id_phieucham, diemphat, diemthuong,
      diemthuongthamdinhlan2, diemphatthamdinhlan2,
      yeucaugiaitrinhdiemphat, yeucaugiaitrinhdiemthuong
    } = req.body;
    try {
      let item = await Phieuchamdiems.findByIdAndUpdate(id_phieucham, {
        phieuchamdiem_detail: list,
        diemphat, diemthuong,
        diemthuongthamdinhlan2, diemphatthamdinhlan2,
        yeucaugiaitrinhdiemphat, yeucaugiaitrinhdiemthuong
      }).populate("taikhoan");
      // console.log(req.userId)
      await saveAction(req.userId.userId, `Cập nhật điểm thẩm định của ${item.taikhoan.tenhienthi} năm ${item.year}`)
      res.status(200).json({ message: "Cập nhật điểm thẩm định thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  trackingBangdiem: async (req, res) => {
    let { year } = req.query;
    try {
         const schema = Joi.object({
        year: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        year: year,
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
      let items = await Phieuchamdiems.find({ year: value.year }).populate("taikhoan");
      // console.log(items)
      let taikhoans = await Users.find({ role: "Quản trị tại đơn vị", taikhoancap: { $ne: ["xã"] } });
      // console.log(taikhoans)
      let data = [];

      for (let i of taikhoans) {
        // console.log(i._id.toString())
        let checked = items.find(e => e.taikhoan._id.toString() === i._id.toString());
        // console.log(checked)
        let checked_trangthaichotso = false;
        if (checked) {
          checked_trangthaichotso = checked.chotdiemtucham.status;
        };

        if (checked) {
          data.push({
            donvi: i.tenhienthi,
            dachamdiem: true,
            time: checked.chotdiemtucham.time || "",
            trangthaichotso: checked_trangthaichotso,
            idPhieucham: checked._id,
            trangthaixuly: checked.trinhlanhdao.trangthai[checked.trinhlanhdao.trangthai.length - 1].text,
            files: checked.chotdiemtucham.files
          })
        } else {
          data.push({
            donvi: i.tenhienthi,
            dachamdiem: false,
            time: "",
            trangthaixuly: "Chưa chấm điểm",
            trangthaichotso: false,
            files: []
          })
        }
      }
      // data = items.filter(i=> i.taikhoan.role === "Quản trị tại đơn vị");
      res.status(200).json(data)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  trackingBangdiemCapxa: async (req, res) => {
    let { year } = req.query;
    try {
        const schema = Joi.object({
        year: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        year: year,
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
      let items = await Phieuchamdiems.find({ year: value.year }).populate("taikhoan");
      // console.log(items)
      let taikhoans = await Users.find({ role: "Quản trị tại đơn vị", taikhoancap: ["xã"] });
      // console.log(taikhoans)
      let data = [];

      for (let i of taikhoans) {
        // console.log(i._id.toString())
        let checked = items.find(e => e.taikhoan._id.toString() === i._id.toString());
        // console.log(checked)
        let checked_trangthaichotso = false;
        if (checked) {
          checked_trangthaichotso = checked.chotdiemtucham.status;
        };

        if (checked) {
          data.push({
            donvi: i.tenhienthi,
            dachamdiem: true,
            time: checked.chotdiemtucham.time || "",
            trangthaichotso: checked_trangthaichotso,
            trangthaixuly: checked.trinhlanhdao.trangthai[checked.trinhlanhdao.trangthai.length - 1].text,
            idPhieucham: checked._id,
            files: checked.chotdiemtucham.files
          })
        } else {
          data.push({
            donvi: i.tenhienthi,
            dachamdiem: false,
            time: "",
            trangthaixuly: "Chưa chấm điểm",
            trangthaichotso: false,
            files: []
          })
        }
      }
      // data = items.filter(i=> i.taikhoan.role === "Quản trị tại đơn vị");
      res.status(200).json(data)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },


  changeStatusChotdiem: async (req, res) => {
    let { id } = req.query;
    try {
      let item = await Phieuchamdiems.findById(id).populate("taikhoan");
      item.chotdiemtucham.status = !item.chotdiemtucham.status;
      await item.save();
      await saveAction(req.userId.userId, `Thay đổi trạng thái chốt điểm của ${item.taikhoan.tenhienthi} năm ${item.year}`)
      res.status(200).json({ message: "Thay đổi trạng thái chốt sổ thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  getDataOfChart: async (req, res) => { // xeeps loai diem tham dinh cap phong, huyen
    let { year } = req.query;
          const schema = Joi.object({
            year: Joi.string().required(),
          });
    
          const { error, value } = schema.validate({
            year
          });
          if (error) {
            return res.status(400).json({ status: false, message: 'Lỗi giá trị nhập vào từ người dùng. Vui lòng kiểm tra lại' });
          }
    try {
      // let taikhoans = await Users.find({ role: "Quản trị tại đơn vị", taikhoancap: ['phòng'] });
      let taikhoans = await Users.find({ role: "Quản trị tại đơn vị", taikhoancap: { $ne: ['xã'] } });

      let data = [];
      for (let taikhoan of taikhoans) {
        let phieudiem = await Phieuchamdiems.findOne({ taikhoan: taikhoan._id, year:value.year }).populate('phieuchamdiem.linhvuc').populate('phieuchamdiem.tieuchi_group.tieuchi').populate('phieuchamdiem.tieuchi_group.tieuchithanhphan.tieuchithanhphan');;

        if (!phieudiem) {
          data.push({
            donvi: taikhoan.tenhienthi,
            tongdiemtucham: 0,
            tongdiemthamdinh: 0
          })
        } else {
          // console.log(phieudiem)
          let list = phieudiem.phieuchamdiem;
          let tongdiemtucham = 0;
          let tongdiemthamdinh = 0;
          // console.log(list[0].tieuchi_group[0].tieuchithanhphan)
          for (let i of list) {
            let tieuchi_group = i.tieuchi_group;
            let tieuchiList = [];
            let total_diemtuchamlinhvuc = 0;
            let total_diemthamdinhlinhvuc = 0;

            for (let tieuchi of tieuchi_group) {
              let total_diemtuchamtieuchi = 0;
              let total_diemthamdinhtieuchi = 0;
              tieuchi.tieuchithanhphan.forEach(el => {
                total_diemtuchamtieuchi += el.diemtucham
                total_diemthamdinhtieuchi += el.diemthamdinh
              })
              total_diemthamdinhlinhvuc += total_diemthamdinhtieuchi
              total_diemtuchamlinhvuc += total_diemtuchamtieuchi
            };

            tongdiemtucham += total_diemtuchamlinhvuc;
            tongdiemthamdinh += total_diemthamdinhlinhvuc;

          };

          data.push({
            donvi: taikhoan.tenhienthi,
            tongdiemtucham: tongdiemtucham,
            tongdiemthamdinh: tongdiemthamdinh + phieudiem.diemthuong - phieudiem.diemphat
          })
        }
      };
      data.sort((a, b) => b.tongdiemthamdinh - a.tongdiemthamdinh);

      let data_ranks = [];
      let i = 0;
      while (data.length !== 0) {
        let index_slice = data.filter(e => e.tongdiemthamdinh === data[0].tongdiemthamdinh).length;
        // console.log(index_slice)
        let data_slice = data.slice(0, index_slice);
        data_slice.forEach(el => {
          data_ranks.push({
            ...el, rank: i + 1
          })
        })
        data = data.slice(index_slice);
        i++;
      }

      res.status(200).json({ message: "", data: data_ranks })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  getDataXeploaiCapxa: async (req, res) => {
    let { year } = req.query;
    try {
        const schema = Joi.object({
        year: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        year: year,
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
      let taikhoans = await Users.find({ role: "Quản trị tại đơn vị", taikhoancap: ["xã"] });

      let data = [];
      for (let taikhoan of taikhoans) {
        let phieudiem = await Phieuchamdiems.findOne({ taikhoan: taikhoan._id, year: value.year }).populate('phieuchamdiem.linhvuc').populate('phieuchamdiem.tieuchi_group.tieuchi').populate('phieuchamdiem.tieuchi_group.tieuchithanhphan.tieuchithanhphan');;

        if (!phieudiem) {
          data.push({
            tentaikhoan: taikhoan.tentaikhoan,
            donvi: taikhoan.tenhienthi,
            tongdiemtucham: 0,
            tongdiemthamdinh: 0
          })
        } else {
          // console.log(phieudiem)
          let list = phieudiem.phieuchamdiem;
          let tongdiemtucham = 0;
          let tongdiemthamdinh = 0;
          // console.log(list[0].tieuchi_group[0].tieuchithanhphan)
          for (let i of list) {
            let tieuchi_group = i.tieuchi_group;
            // let tieuchiList = [];
            let total_diemtuchamlinhvuc = 0;
            let total_diemthamdinhlinhvuc = 0;

            for (let tieuchi of tieuchi_group) {
              let total_diemtuchamtieuchi = 0;
              let total_diemthamdinhtieuchi = 0;

              tieuchi.tieuchithanhphan.forEach(el => {
                total_diemtuchamtieuchi += el.diemtucham
                total_diemthamdinhtieuchi += el.diemthamdinh
              });

              total_diemthamdinhlinhvuc += total_diemthamdinhtieuchi
              total_diemtuchamlinhvuc += total_diemtuchamtieuchi
            };

            tongdiemtucham += total_diemtuchamlinhvuc;
            tongdiemthamdinh += total_diemthamdinhlinhvuc;
          };

          data.push({
            tentaikhoan: taikhoan.tentaikhoan,
            donvi: taikhoan.tenhienthi,
            tongdiemtucham: tongdiemtucham,
            tongdiemthamdinh: tongdiemthamdinh + phieudiem.diemthuong - phieudiem.diemphat
          })
        }
      };
      data.sort((a, b) => b.tongdiemthamdinh - a.tongdiemthamdinh)

      let data_ranks = [];
      let i = 0;
      while (data.length !== 0) {
        let index_slice = data.filter(e => e.tongdiemthamdinh === data[0].tongdiemthamdinh).length;
        // console.log(index_slice)
        data_slice = data.slice(0, index_slice);
        data_slice.forEach(el => {
          data_ranks.push({
            ...el, rank: i + 1
          })
        })
        data = data.slice(index_slice);
        i++;
      }

      // console.log(data)
      res.status(200).json({ message: "", data: data_ranks })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  getQuantrichamdiems: async (req, res) => {
    try {
      let list = await Quantrichamdiem.find({
      }).sort({ nam: -1 });
      res.status(200).json(list);
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên" + "Mã lỗi:" + error.message,
      });
    }
  },

  addQuantrichamdiem: async (req, res) => {
    try {
      let newItem = new Quantrichamdiem(req.body);
      await newItem.save();

      let list = await Quantrichamdiem.find({
      }).sort({ nam: -1 })
      res.status(200).json({ list, message: "Lưu dữ liệu thành công!" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: "Có lỗi xảy ra. Vui lòng liên hệ quản trị viên hệ thống. \n Mã lỗi: " + error.message,
      });
    }
  },

  updateQuantrichamdiem: async (req, res) => {
    let { nam, status, ngayhethanchamdiem, ngayhethanthamdinh } = req.body;
    // console.log(req.body)
    nam = Number(nam)
    let id = req.params.id;
    // console.log(status)
    try {
      await Quantrichamdiem.findByIdAndUpdate(id, {
        nam, trangthai: status, ngayhethanchamdiem, ngayhethanthamdinh
      });

      let list = await Quantrichamdiem.find({
      }).sort({ nam: -1 })

      res.status(200).json({ list, message: "Update dữ liệu thành công!" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: "Có lỗi xảy ra khi update. Vui lòng liên hệ quản trị viên",
      });
    }
  },

  deleteQuantrichamdiem: async (req, res) => {
    let id = req.params.id;
    try {
      await Quantrichamdiem.findByIdAndDelete(id);
      let list = await Quantrichamdiem.find({
      }).sort({ nam: -1 });

      res.status(200).json({ list, message: "Thao tác xóa thành công!" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  //xóa phiếu chấm điểm....
  resetPhieuchamdiem: async (req, res) => {
    let id = req.params.id; //id phieu cham muon xoa
    try {
      let item = await Phieuchamdiems.findById(id).populate('taikhoan');
      for (let i of item.phieuchamdiem) {
        for (let e of i.tieuchi_group) {
          for (let el of e.tieuchithanhphan) {
            if (el.files.length > 0) {
              for (let file of el.files) {
                fs.unlinkSync(path.join(__dirname, `../upload/${req.userId.userId}/` + file));
              }
            }
          }
        }
      };

      if (item.chotdiemtucham.files.length > 0) {
        for (let file of item.chotdiemtucham.files) {
          fs.unlinkSync(path.join(__dirname, `../upload/${req.userId.userId}/` + file));
        }
      };

      await saveAction(req.userId.userId, `Reset phiếu chấm điểm của ${item.taikhoan.tenhienthi} năm ${item.year}`)
      await Phieuchamdiems.findByIdAndDelete(id);
      res.status(200).json({ message: "Xóa phiếu chấm điểm thành công!" })
    } catch (error) {

    }
  },


  saveUploadtailieuDiemthuong: async (req, res) => {
    // console.log(req.body)
    // console.log(req.files)
    let { filesSaved, filesDelete, ghichucuadonvi } = req.body;
    // console.log(req.body)
    // console.log(id_linhvuc)
    try {
      //xóa bỏ các file cần xóa, gộp các file giữ lại + thêm mới 
      let { id_phieucham } = req.params;
      //files đính kèm của từng tiêu chí
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);

     for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }


      files = JSON.parse(filesSaved).concat(files)
      let phieucham = await Phieuchamdiems.findById(id_phieucham);
      phieucham.ghichudiemthuong.ghichucuadonvi = ghichucuadonvi;
      phieucham.ghichudiemthuong.files = files;
      await phieucham.save();
      await saveAction(req.userId.userId, `Upload tài liệu điểm thưởng`)
      res.status(200).json({ message: "Lưu tài liệu điểm thưởng thành công", files: files, ghichucuadonvi })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  saveUploadtailieuDiemphat: async (req, res) => {
    // console.log(req.body)
    // console.log(req.files)
    let { filesSaved, filesDelete, ghichucuadonvi } = req.body;
    // console.log(req.body)
    // console.log(id_linhvuc)
    try {
      //xóa bỏ các file cần xóa, gộp các file giữ lại + thêm mới 
      let { id_phieucham } = req.params;
      //files đính kèm của từng tiêu chí
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);

    for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }


      files = JSON.parse(filesSaved).concat(files)

      let phieucham = await Phieuchamdiems.findById(id_phieucham);
      phieucham.ghichudiemphat.ghichucuadonvi = ghichucuadonvi;
      phieucham.ghichudiemphat.files = files;
      await phieucham.save()
      await saveAction(req.userId.userId, `Upload tài liệu điểm phạt`)
      res.status(200).json({ message: "Lưu tài liệu điểm phạt thành công", files: files, ghichucuadonvi })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  saveUploadtailieuDiemthuongGiaitrinh: async (req, res) => {
    let { filesSaved, filesDelete, ghichucuadonvi } = req.body;

    try {
      //xóa bỏ các file cần xóa, gộp các file giữ lại + thêm mới 
      let { id } = req.params;
      // console.log(id_phieucham)
      //files đính kèm của từng tiêu chí
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);

      for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }


      files = JSON.parse(filesSaved).concat(files)

      let phieucham = await Phieuchamdiems.findById(id);
      // console.log(phieucham)
      phieucham.ghichudiemthuonggiaitrinh.ghichucuadonvi = ghichucuadonvi;
      phieucham.ghichudiemthuonggiaitrinh.files = files;
      await phieucham.save();
      await saveAction(req.userId.userId, `Upload tài liệu điểm thưởng giải trình`)
      res.status(200).json({ message: "Lưu tài liệu điểm thưởng giải trình thành công", files: files, ghichucuadonvi })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  saveUploadtailieuDiemphatGiaitrinh: async (req, res) => {
    // console.log(req.body)
    // console.log(req.files)
    let { filesSaved, filesDelete, ghichucuadonvi } = req.body;
    // console.log(req.body)
    // console.log(id_linhvuc)
    try {
      //xóa bỏ các file cần xóa, gộp các file giữ lại + thêm mới 
      let { id } = req.params;
      //files đính kèm của từng tiêu chí
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });

      filesDelete = JSON.parse(filesDelete);

     for (const filename of filesDelete) {
        // Làm sạch tên file
        const safeFileName = sanitize(path.basename(filename));

        // Kiểm tra tính hợp lệ của tên file
        if (!safeFileName || !/^[a-zA-Z0-9_\-\.]+$/.test(safeFileName)) {
          console.log(`Invalid filename: ${filename}`);
          continue; // bỏ qua file không hợp lệ
        }

        const filePath = path.join(__dirname, `../upload/${req.userId.userId}/`, safeFileName);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`The file ${filePath} exists and was deleted.`);
          } catch (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          }
        } else {
          console.log(`The file ${filePath} does not exist.`);
        }
      }


      files = JSON.parse(filesSaved).concat(files)
      let phieucham = await Phieuchamdiems.findById(id);
      // console.log(phieucham)
      phieucham.ghichudiemphatgiaitrinh.ghichucuadonvi = ghichucuadonvi;
      phieucham.ghichudiemphatgiaitrinh.files = files;
      await phieucham.save();
      await saveAction(req.userId.userId, `Upload tài liệu điểm phạt giải trình`)
      res.status(200).json({ message: "Lưu tài liệu điểm phạt giải trình thành công", files: files, ghichucuadonvi })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  updateGhichuthamdinhDiemthuong: async (req, res) => {
    let { ghichucuathamdinh } = req.body;
    // console.log(req.body)
    try {
      let { id } = req.params;
      // console.log(id)
      let phieucham = await Phieuchamdiems.findById(id);
      phieucham.ghichudiemthuong.ghichucuathamdinh = ghichucuathamdinh;
      await phieucham.save();
      await saveAction(req.userId.userId, `Thêm ghi chú thẩm định điểm thưởng`)
      res.status(200).json({ message: "Lưu ghi chú thẩm định điểm thưởng thành công", ghichucuathamdinh })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  updateGhichuthamdinhDiemphat: async (req, res) => {
    let { ghichucuathamdinh } = req.body;
    // console.log(id_linhvuc)
    try {
      let { id } = req.params;
      // console.log(id)
      let phieucham = await Phieuchamdiems.findById(id);

      phieucham.ghichudiemphat.ghichucuathamdinh = ghichucuathamdinh;

      await phieucham.save();
      await saveAction(req.userId.userId, `Thêm ghi chú thẩm định điểm phạt`)
      res.status(200).json({ message: "Lưu ghi chú thẩm định điểm phạt thành công", ghichucuathamdinh })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  updateGhichuThamdinhDiemthuongGiaitrinh: async (req, res) => {
    let { ghichucuathamdinh } = req.body;
    // console.log(req.body)
    try {
      let { id } = req.params;
      // console.log(id)
      let phieucham = await Phieuchamdiems.findById(id);
      phieucham.ghichudiemthuonggiaitrinh.ghichucuathamdinh = ghichucuathamdinh;
      await phieucham.save();
      await saveAction(req.userId.userId, `Thêm ghi chú thẩm định điểm thưởng giải trình`)
      res.status(200).json({ message: "Lưu ghi chú thẩm định điểm thưởng giải trình thành công", ghichucuathamdinh })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  updateGhichuThamdinhDiemphatGiaitrinh: async (req, res) => {
    let { ghichucuathamdinh } = req.body;
    // console.log(id_linhvuc)
    try {
      let { id } = req.params;
      // console.log(id)
      let phieucham = await Phieuchamdiems.findById(id);

      phieucham.ghichudiemphatgiaitrinh.ghichucuathamdinh = ghichucuathamdinh;

      await phieucham.save();
      await saveAction(req.userId.userId, `Thêm ghi chú thẩm định điểm phạt giải trình`)
      res.status(200).json({ message: "Lưu ghi chú thẩm định điểm phạt giải trình thành công", ghichucuathamdinh })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },




  fetchFileUploadTucham: async (req, res) => {
    let { year } = req.query;
    year = Number(year)
    try {
      let user = await Users.findById(req.params.id);
      let cap = user.taikhoancap[0];
      let item = await Phieuchamdiems.findOne({ year, taikhoan: req.params.id }).populate('phieuchamdiem.linhvuc').populate('phieuchamdiem.tieuchi_group.tieuchi').populate('phieuchamdiem.tieuchi_group.tieuchithanhphan.tieuchithanhphan');
      // console.log(item.phieuchamdiem[0].tieuchi_group[0].tieuchithanhphan)
      if (!item) {
        let phieuchamdiem = [];
        res.status(200).json({
          data: phieuchamdiem,
          id_phieucham: "",
          chotdiemtucham: false,
          captaikhoan: cap
        })
      } else {
        let data = [];
        let list = item.phieuchamdiem;
        // console.log(list[0].tieuchi_group[0].tieuchithanhphan)
        for (let i of list) {
          //check xem lĩnh vực nào được sử dụng cho cấp, cho năm
          let tieuchi_group = i.tieuchi_group;
          let tieuchiList = [];

          for (let tieuchi of tieuchi_group) {
            let tieuchithanhphan = [];
            if (cap === "xã") { //TH cấp xã
              tieuchithanhphan = tieuchi.tieuchithanhphan.map(e => ({
                tentieuchi: e.tieuchithanhphan.tentieuchi,
                phanloaidanhgia: e.tieuchithanhphan.phanloaidanhgiacapxa,
                files: e.files,
                _id: e.tieuchithanhphan._id,
              }));

            } else if (cap === "huyện") {
              tieuchithanhphan = tieuchi.tieuchithanhphan.map(e => ({
                tentieuchi: e.tieuchithanhphan.tentieuchi,
                phanloaidanhgia: e.tieuchithanhphan.phanloaidanhgiacaphuyen,
                files: e.files,
                _id: e.tieuchithanhphan._id,
              }));
            } else {
              tieuchithanhphan = tieuchi.tieuchithanhphan.map(e => ({
                tentieuchi: e.tieuchithanhphan.tentieuchi,
                phanloaidanhgia: e.tieuchithanhphan.phanloaidanhgia,
                files: e.files,
                _id: e.tieuchithanhphan._id,
              }));
            };

            tieuchiList.push({
              tieuchi: { ...tieuchi.tieuchi._doc },
              tieuchithanhphan
            });
          };

          data.push({
            linhvuc: { ...i.linhvuc._doc },
            tieuchi_group: tieuchiList,
          })
        }
        res.status(200).json({ data, id_phieucham: item._id, captaikhoan: cap, chotdiemtucham: item.chotdiemtucham.status })
      };
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  saveTailieuUpload: async (req, res) => {
    try {
      let { id_linhvuc, idPhieucham, id_tieuchi, tieuchithanhphan } = req.body;
      // console.log(req.files)
      let phieucham = await Phieuchamdiems.findById(idPhieucham);
      let linhvuc = phieucham.phieuchamdiem.find(i => i.linhvuc.toString() === id_linhvuc);
      let tieuchi = linhvuc.tieuchi_group.find(i => i.tieuchi._id.toString() === id_tieuchi);
      let tieuchithanhphandb = tieuchi.tieuchithanhphan.find(i => i.tieuchithanhphan.toString() === tieuchithanhphan);
      let files = req.files.map(i => {
        let path = i.path;
        let index = path.lastIndexOf('\\');
        return path.slice(index + 1)
      });
      tieuchithanhphandb.files = tieuchithanhphandb.files.concat(files)
      await phieucham.save();
      // console.log(req.files)
      await saveAction(req.userId.userId, `Thêm tài liệu kiểm chứng ${req.files.map(i => i.filename).toString()}`)
      res.status(200).json({ message: "Lưu tài liệu thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  deleteTailieuUpload: async (req, res) => {
    try {
      let { id_linhvuc, idPhieucham, id_tieuchi, file, tieuchithanhphan } = req.body;
      // console.log(req.files)
      let phieucham = await Phieuchamdiems.findById(idPhieucham);
      let linhvuc = phieucham.phieuchamdiem.find(i => i.linhvuc.toString() === id_linhvuc);
      let tieuchi = linhvuc.tieuchi_group.find(i => i.tieuchi._id.toString() === id_tieuchi);
      let tieuchithanhphandb = tieuchi.tieuchithanhphan.find(i => i.tieuchithanhphan.toString() === tieuchithanhphan);

      // let path_delete = path.join(__dirname, `../upload/${req.userId.userId}/` + file);
      // if (fs.existsSync(path_delete)) {
      //   fs.unlinkSync(path.join(__dirname, `../upload/${req.userId.userId}/` + file));
      //   console.log(`The file ${path_delete} exists.`);
      // } else {
      //   console.log(`The file ${path_delete} does not exist.`);
      // }
      // const filename = path.basename(file); // Remove directory parts
const userDir = path.resolve(__dirname, `../upload/${req.userId.userId}/`);
const path_delete = path.resolve(userDir, file);

// Validate filename pattern
const safeFilenamePattern = /^[a-zA-Z0-9_\-\.]+$/;
if (!safeFilenamePattern.test(filename)) {
  throw new Error('Invalid filename.');
}

// Confirm path is within userDir
if (!path_delete.startsWith(userDir)) {
  throw new Error('Invalid file path.');
}

// Check and delete the file
if (fs.existsSync(path_delete)) {
  fs.unlinkSync(path_delete);
}
      tieuchithanhphandb.files = tieuchithanhphandb.files.filter(i => i !== file)
      await phieucham.save()
      await saveAction(req.userId.userId, `Xóa tài liệu kiểm chứng ${file}`)
      res.status(200).json({ message: "Xóa tài liệu thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },

  fetchLichsuHethong: async (req, res) => {
    try {
      let { tentaikhoan, tungay, denngay, action, id } = req.query;
      // console.log(id)
       const schema = Joi.object({
        id: Joi.string().required(),
        action: Joi.string().optional(),
        tungay: Joi.string().optional(),
        denngay: Joi.string().optional(),
      });

      const { error, value } = schema.validate({
        id: id, action, tungay, denngay
      });
      tungay = value.tungay;
      denngay = value.denngay;
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị year' });
      };
      if (tungay === "") {
        tungay = new Date("1970-01-01T00:00:00Z");
      } else {
        tungay = new Date(`${tungay}T00:00:00Z`)
      }
      // console.log(action)
      denngay = new Date(`${denngay}T23:59:59Z`);

      let accounts_con = await Users.find({ capcha: value.id });
      accounts_con = accounts_con.map(i => i._id)
      let items = await HistoriesSystem.find({
        action: { $regex: value.action, $options: "i" },
        user: { $in: accounts_con },
        createdAt: {
          $gte: tungay,
          $lte: denngay,
        }
      }).populate("user").sort({ createdAt: -1 });
      // console.log(items[0])
      items = items.filter(i => i.user.tenhienthi.toLowerCase().indexOf(tentaikhoan.toLowerCase()) !== -1)
      res.status(200).json(items)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  }
};
