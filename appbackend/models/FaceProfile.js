const mongoose = require('mongoose');

const faceProfileSchema = new mongoose.Schema(
{
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true,
        unique:true
    },

    descriptor:{
        type:[Number],
        required:true
    }

},{
    timestamps:true
});

module.exports = mongoose.model(
    'FaceProfile',
    faceProfileSchema
);