const jwt = require("jsonwebtoken");
const RefreshTokens = require("../models/RefreshToken");
const fs = require('fs');
const path = require('path');
const Users = require("../models/Users");
const _ = require('lodash');
const Phieuchamdiems = require("../models/Phieuchamdiem");
const HistoriesSystem = require("../models/HistoriesSystem");
const QuantriNamChamdiem = require("../models/QuanlyNamChamdiem");
const saveAction = async (user_id, action) => {
  let newAction = new HistoriesSystem({
    user: user_id,
    action: action
  })
  await newAction.save();
};

const Joi = require('joi');

// Hàm kiểm tra định dạng ID hợp lệ (ví dụ MongoDB ObjectId)
function isValidObjectId(id) {
  return /^[a-fA-F0-9]{24}$/.test(id);
};


module.exports = {
  login: async (req, res) => {
    try {
      const schema = Joi.object({
        tentaikhoan: Joi.string().required(),
        matkhau: Joi.string().required()
      });

      const { error, value } = schema.validate({
        tentaikhoan: req.body.tentaikhoan,
        matkhau: req.body.matkhau,
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị nhập vào từ người dùng. Vui lòng kiểm tra lại' });
      }
      // console.log(value)
      let user = await Users.findOne(value).populate('capcha');
      if (!user) {
        return res.status(401).json({ status: false, message: "Sai tên đăng nhập hoặc mật khẩu" });
      } else {
        if (user.block_by_admin === true) {
          return res.status(401).json({ status: false, message: "Tài khoản bị khóa bởi quản trị hệ thống, vui lòng liên hệ cơ quan cấp trên" })
        };
        if (user.status === false) {
          return res.status(401).json({ status: false, message: "Tài khoản bị khóa, vui lòng liên hệ cơ quan cấp trên" })
        };

        //cần kiểm tra xem client có refreshtoken k nếu có thì phải kiểm tra db và xóa đi khi login thành công và tạo mới refreshtoken
        let refreshTokenCookie = req.cookies.refreshToken;
        if (refreshTokenCookie) {
          await RefreshTokens.findOneAndDelete({ refreshToken: refreshTokenCookie })
        };

        //generate accessToken, refreshToken
        const accessToken = jwt.sign({ userId: user._id }, "vuvantinh_accessToken", {
          expiresIn: '15d'
        });


        const refreshToken = jwt.sign({ userId: user._id }, "vuvantinh_refreshToken", {
          expiresIn: '30d'
        });

        let newItem = new RefreshTokens({
          refreshToken
        });
        await newItem.save();
        await saveAction(user._id, "Đăng nhập hệ thống")
        res.status(200).json({ status: "success", _id: user._id, captaikhoan: user.taikhoancap, tentaikhoan: user.tenhienthi, accessToken, refreshToken });
      }
    } catch (error) {
      console.log(error.message)
      res.status(401).json({ status: "failed", message: "Lỗi đăng nhập hệ thống" });
    }
  },
  logout: async (req, res) => {
    //xóa refreshTonken trong database
    let refreshTokenCookie = req.cookies.refreshToken;
    try {
      if (refreshTokenCookie) {
        await RefreshTokens.findOneAndDelete({ refreshToken: refreshTokenCookie })
      };

      //xóa cookie
      // res.clearCookie('refreshToken_px01');
      res.status(200).json({ status: "success", message: "Đăng xuất thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Lỗi server hệ thống" });
    }
  },
  getUserList: async (req, res) => {
    try {
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Bộ", "Cấp Cục", "Cấp Tỉnh"] }
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });

      res.status(200).json(users)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi lấy dữ liệu người dùng" });
    }
  },
  //Hàm tạo ra các tài khoản cấp Bộ và Cục, Tỉnh
  addUser: async (req, res) => {
    let { tentaikhoan, id_user, madonvi, tenhienthi, taikhoancap, status, nhom, thutu } = req.body;
    try {
      let newItem = new Users({
        tentaikhoan,
        tenhienthi,
        nhom,
        matkhau: '123456',
        thutu,
        taikhoancap,
        capcha: id_user,
        status,
        madonvi,
        block_by_admin: false
      });

      try {
        fs.mkdirSync(
          path.join(__dirname, `../upload/${newItem._id}`)
        );
        console.log('Folder created successfully (sync)!');
      } catch (err) {
        console.error('Error creating folder (sync):', err);
      };
      await newItem.save();
      await saveAction(req.userId.userId, `Thêm mới tài khoản ${tenhienthi}`);

      //lọc ra các 
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Bộ", "Cấp Cục", "Cấp Tỉnh"] }
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      res.status(200).json({ status: "success", users, message: "Thêm mới thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi thêm mới người dùng" });
    }
  },
  editUser: async (req, res) => {
    let id = req.params.id;
    let { tentaikhoan, madonvi, tenhienthi, taikhoancap, nhom, status, thutu } = req.body;
    try {
      await Users.findByIdAndUpdate(id, {
        tentaikhoan,
        thutu,
        taikhoancap,
        status,
        nhom,
        tenhienthi,
        madonvi
      });
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Bộ", "Cấp Cục", "Cấp Tỉnh"] }
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      await saveAction(req.userId.userId, `Chỉnh sửa tài khoản ${tenhienthi}`)
      res.status(200).json({ status: "success", users, message: "Cập nhật tài khoản người dùng thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi cập nhật tài khoản người dùng" });
    }
  },
  deleteUser: async (req, res) => {
    let id = req.params.id;
    // console.log(id)
     const schema = Joi.object({
        id: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        id
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị nhập vào từ người dùng. Vui lòng kiểm tra lại' });
      }
    try {
      let item = await Users.findById(id);
      let checked = await Users.findOne({
        taikhoancap: { $in: ["Cấp Phòng", "Cấp Xã"] },
        capcha: value.id
      });

      if (checked !== null) {
        return res.status(401).json({ status: "failed", message: "Không thể xóa tài khoản do có tài khoản cấp dưới đang thuộc tài khoản bạn muốn xóa." });
      };
      //xóa toàn bộ cuộc chấm điểm và phiếu chấm tạo bởi user
      await QuantriNamChamdiem.deleteMany({ user_created: item._id });
      await Phieuchamdiems.deleteMany({ user_created: item._id })

      await Users.findByIdAndDelete(id);

      let user_list_con = await Users.find({ capcha: value.id });
      for (let i of user_list_con) {
        // Giả sử i._id là giá trị cần kiểm tra
        let folderId = i._id;

        if (isValidObjectId(folderId)) {
          const folderPath = path.join(__dirname, "../upload/", folderId);
          try {
            fs.rmdirSync(folderPath);
            console.log('Folder removed successfully (sync)!');
          } catch (err) {
            console.error('Error removing folder (sync):', err);
          }
        } else {
          console.error('Invalid folder ID:', folderId);
        }
        await QuantriNamChamdiem.deleteMany({ user_created: i._id });
        await Phieuchamdiems.deleteMany({ user_created: i._id })
        await Phieuchamdiems.deleteMany({ taikhoan: i._id })
      };


      const folderIdCha = id;

      if (isValidObjectId(folderIdCha)) {
        const folderPathCha = path.join(__dirname, "../upload/", folderIdCha);
        try {
          fs.rmdirSync(folderPathCha);
          console.log('Folder removed successfully (sync)!');
        } catch (err) {
          console.error('Error removing folder (sync):', err);
        }
      } else {
        console.error('Invalid folder ID:', folderIdCha);
      }
      // check xem có phiếu điểm của tài khoản đang muốn xóa hay không, nếu có thì đưa ra thông báo k được xóa,
      // mà chỉ thay đổi được trạng thái sử dụng thôi
      await saveAction(req.userId.userId, `Xóa tài khoản ${item.tentaikhoan}`)
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Bộ", "Cấp Cục", "Cấp Tỉnh"] }
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      res.status(200).json({ status: "success", users, message: "Xóa tài khoản người dùng thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi xóa người dùng" });
    }
  },
  changeStatusAccounts: async (req, res) => {
    let { data } = req.body;
    try {
      for (let i of data) {
        let item = await Users.findById(i);
        // console.log(item)
        item.status = !item.status;
        item.time_block = new Date()
        await item.save();
      };
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Bộ", "Cấp Cục", "Cấp Tỉnh"] }
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      res.status(200).json({ users, message: "Thay đổi trạng thái hoạt động thành công!" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  //Hàm tạo tài khoản cấp phòng, xã của các tài khoản cấp tỉnh
  getUserListOfCapTinh: async (req, res) => {
    let id_user = req.query.id_user;

    const schema = Joi.object({
      id_user: Joi.string().required(),
    });

    const { error, value } = schema.validate({
      id_user: id_user,
    });
    if (error) {
      return res.status(400).json({ status: false, message: 'Lỗi giá trị id_user' });
    };

    try {
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Phòng", "Cấp Xã"] },
        capcha: value.id_user
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });

      res.status(200).json(users)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi lấy dữ liệu người dùng" });
    }
  },
  addUserOfCapTinh: async (req, res) => {
    let { tentaikhoan, id_user, madonvi, tenhienthi, taikhoancap, status, nhom, thutu } = req.body;
    try {
      let newItem = new Users({
        tentaikhoan,
        tenhienthi,
        nhom,
        matkhau: '123456',
        thutu,
        taikhoancap,
        capcha: id_user,
        status,
        madonvi,
        block_by_admin: false
      });
      await newItem.save();
      await saveAction(req.userId.userId, `Thêm mới tài khoản ${tenhienthi}`);
      try {
        fs.mkdirSync(
          path.join(__dirname, `../upload/${newItem._id}`)
        );
        console.log('Folder created successfully (sync)!');
      } catch (err) {
        console.error('Error creating folder (sync):', err);
      }
      //lọc ra các 

      const schema = Joi.object({
        id_user: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        id_user: id_user,
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị id_user' });
      };
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Phòng", "Cấp Xã"] },
        capcha: value.id_user
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      res.status(200).json({ status: "success", users, message: "Thêm mới thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi thêm mới người dùng" });
    }
  },
  editUserOfCapTinh: async (req, res) => {
    let id = req.params.id;
    let { tentaikhoan, madonvi, tenhienthi, nhom, id_user, status, thutu } = req.body;

    try {
      await Users.findByIdAndUpdate(id, {
        tentaikhoan,
        thutu,
        tenhienthi,
        status,
        nhom,
        madonvi
      });

      const schema = Joi.object({
        id_user: Joi.string().required(),
      });

      const { error, value } = schema.validate({
        id_user: id_user,
      });
      if (error) {
        return res.status(400).json({ status: false, message: 'Lỗi giá trị id_user' });
      };
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Phòng", "Cấp Xã"] },
        capcha: value.id_user
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      await saveAction(req.userId.userId, `Chỉnh sửa tài khoản ${tenhienthi}`)
      res.status(200).json({ status: "success", users, message: "Cập nhật tài khoản người dùng thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi cập nhật tài khoản người dùng" });
    }
  },
  deleteUserOfCapTinh: async (req, res) => {
    let id = req.params.id;
    // console.log(id)
    let id_user = req.query.id_user
    try {
      let item = await Users.findById(id);

      //xóa tất cả các phiếu chấm điểm của tài khoản đó sau đó xóa thư mục id user
      await Phieuchamdiems.deleteMany({
        taikhoan: item._id
      });

     const folderIdCha = id;

      if (isValidObjectId(folderIdCha)) {
        const folderPathCha = path.join(__dirname, "../upload/", folderIdCha);
        try {
          fs.rmdirSync(folderPathCha);
          console.log('Folder removed successfully (sync)!');
        } catch (err) {
          console.error('Error removing folder (sync):', err);
        }
      } else {
        console.error('Invalid folder ID:', folderIdCha);
      };

      await Users.findByIdAndDelete(id);

      await saveAction(req.userId.userId, `Xóa tài khoản ${item.tentaikhoan}`);

        const schema = Joi.object({
      id_user: Joi.string().required(),
    });

    const { error, value } = schema.validate({
      id_user: id_user,
    });
    if (error) {
      return res.status(400).json({ status: false, message: 'Lỗi giá trị id_user' });
    };
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Phòng", "Cấp Xã"] },
        capcha: value.id_user
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      res.status(200).json({ status: "success", users, message: "Xóa tài khoản người dùng thành công" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi Khóa người dùng" });
    }
  },
  changeStatusAccountsOfCapTinh: async (req, res) => {
    let { data, id_user, block_by_admin } = req.body;
    try {
      for (let i of data) {
        let item = await Users.findById(i);
        // console.log(item)
        if (block_by_admin) {
          item.block_by_admin = !item.block_by_admin;
          await item.save();
        } else {
          item.status = !item.status;
          item.time_block = new Date()
          await item.save();
        }
      };
      const schema = Joi.object({
      id_user: Joi.string().required(),
    });

    const { error, value } = schema.validate({
      id_user: id_user,
    });
    if (error) {
      return res.status(400).json({ status: false, message: 'Lỗi giá trị id_user' });
    };
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Phòng", "Cấp Xã"] },
        capcha: value.id_user
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });
      res.status(200).json({ users, message: "Thay đổi trạng thái hoạt động thành công!" })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  requestRefreshToken: async (req, res) => {
    // console.log(req.cookies)
    const refreshToken = req.cookies.refreshToken_chamdiemcaicach;
    // console.log(refreshToken)
    if (!refreshToken) {
      return res.status(401).json({ message: 'Token không tồn tại. Vui lòng đăng nhập' })
    };
    // console.log(refreshToken)
    // kiểm tra xem trong db có refreshtoken này không nếu k có thì là k hợp lệ
    const checkRefreshTokenInDb = await RefreshTokens.findOne({ refreshToken });
    // console.log('token',checkRefreshTokenInDb)
    // console.log(checkRefreshTokenInDb)
    if (!checkRefreshTokenInDb) return res.status(403).json({ message: "Token không hợp lệ" });

    jwt.verify(refreshToken, "vuvantinh_refreshToken", async (err, user) => {
      if (err) {
        console.log(err.message)
      };

      const newAccessToken = jwt.sign({ userId: user.userId }, "vuvantinh_accessToken", {
        expiresIn: '15d'
      });

      const newRefreshToken = jwt.sign({ userId: user.userId }, "vuvantinh_refreshToken", {
        expiresIn: '30d'
      });

      await RefreshTokens.findOneAndDelete({ refreshToken: refreshToken })
      // thêm refreshtoken mới vào db sau đó trả về client accesstoken mới
      let newItem = new RefreshTokens({
        refreshToken: newRefreshToken
      });
      await newItem.save()
      res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
      console.log('ok')
    })
  },
  changePassword: async (req, res) => {
    let { id, matkhaucu, matkhaumoi } = req.body;
    try {
      const schema = Joi.object({
      id: Joi.string().required(),
      matkhaucu: Joi.string().required(),
    });

    const { error, value } = schema.validate({
      id: id, matkhaucu:matkhaucu
    });
    if (error) {
      return res.status(400).json({ status: false, message: 'Lỗi giá trị id' });
    };
      let user = await Users.findOne({ _id: value.id, matkhau: value.matkhaucu });
      if (!user) {
        console.log('sai mk')
        res.status(401).json({ message: "Mật khẩu cũ không chính xác. Vui lòng kiểm tra lại" })
        return;
      }

      user.matkhau = matkhaumoi;
      await user.save();
      // console.log(req.user_created)
      // await saveAction(req.userId.userId, `Thay đổi mật khẩu`)
      res.status(200).json({ message: "Đổi mật khấu thành công. Vui lòng đăng nhập lại." })
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Lỗi server, Vui lòng liên hệ quản trị hệ thống" });
    }
  },
  fetchAccountLevelChaBeforeAdd: async (req, res) => {
    try {
      let items = await Users.find({
        level: "Cấp cha"
      }).populate('account_cha', { _id: 1, tenhienthi: 1 });

      res.status(200).json(items)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({
        status: "failed",
        message: error.message,
      });
    }
  },
  getUserCapTinh: async (req, res) => {
    try {
      let users = await Users.find({
        "taikhoancap": { $in: ["Cấp Tỉnh"] }
      }).populate('capcha', { _id: 1, tenhienthi: 1 }).sort({ thutu: 1 });

      res.status(200).json(users)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra khi lấy dữ liệu người dùng" });
    }
  },
  getNhomchucnang: async (req, res) => {
    let taikhoancap = req.query.taikhoancap;
    try {
      if (taikhoancap === "Cấp Bộ") {
        return res.status(200).json([
          "Các đơn vị thuộc cơ quan Bộ có chức năng giải quyết TTHC cho cá nhân, tổ chức",
          "Các đơn vị thuộc cơ quan Bộ không có chức năng giải quyết TTHC cho cá nhân, tổ chức",
          "Công an cấp tỉnh"
        ])
      } else if (taikhoancap === "Cấp Tỉnh") {
        return res.status(200).json([
          "Phòng có chức năng giải quyết thủ tục hành chính",
          "Phòng không có chức năng giải quyết thủ tục hành chính",
          "Cấp Xã"
        ])
      }
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
    }
  },
  //lấy ra các tài khoản cấp con của 1 tài khoản
  fetchChildrenUser: async (req, res) => {
    let { id_user, year } = req.query;
const schema = Joi.object({
      id_user: Joi.string().required(),
      year: Joi.number().required(),
    });

    const { error, value } = schema.validate({
      id_user: id_user,
      year: year
    });
    if (error) {
      return res.status(400).json({ status: false, message: 'Lỗi giá trị đầu vào' });
    };
    let cuocChamDiem = await QuantriNamChamdiem.findOne({ user_created: value.id_user, nam: value.year });
    if (cuocChamDiem === null) {
      return res.status(401).json({ status: "failed", message: "Chưa có cuộc chấm điểm năm " + year });
    }
    try {
      let items = await Users.find({ capcha: value.id_user }, { _id: 1, tenhienthi: 1, time_block: 1, status: 1 }).sort({ thutu: 1 });

      items = items.filter(e => {
        let date_start_chamdiem = (new Date(cuocChamDiem.thoigianbatdautucham)).getTime();
        let date_block_user = e.status === true ? (new Date(e.time_block)).getTime() : (new Date()).getTime()
        let check = (e.status === false && date_start_chamdiem > date_block_user)
        return e.status === true || check
      })

      res.status(200).json(items)
    } catch (error) {
      console.log("lỗi: ", error.message);
      res.status(401).json({ status: "failed", message: "Có lỗi xảy ra" });
    }
  }
};
