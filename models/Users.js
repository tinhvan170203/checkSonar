const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    tentaikhoan: {
        type: String,
        unique: true,
        required: true
    },
    madonvi: {
        type: String,
        unique: true,
        required: true
    },
    nhom: String,
    matkhau: String,
    taikhoancap: String, // cấp 1, cấp 2, cấp 3 xã === phòng là cấp 3
    tenhienthi: String,
    status: Boolean,
    capcha: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    },
    time_block: Date,
    thutu: Number,
    block_by_admin: Boolean
});

const Users = mongoose.model('Users', userSchema);

module.exports = Users;