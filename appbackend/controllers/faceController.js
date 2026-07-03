const FaceProfile = require('../models/FaceProfile');


const { extractDescriptor } = require('../services/flaskService');

const { euclideanDistance } = require('../utils/faceCompare');

const { checkIn } = require('../services/attendanceService');

const { isFaceMatched } = require("../utils/faceCompare");


const registerFace = async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'imageBase64 is required'
      });
    }

    const flaskResponse = await extractDescriptor(imageBase64);

    if (!flaskResponse.success) {
      return res.status(400).json({
        success: false,
        message: 'Unable to detect face in image'
      });
    }

    await FaceProfile.findOneAndUpdate(
      { userId: req.user._id },
      { descriptor: flaskResponse.descriptor },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Face registered successfully'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const checkInImage = async (req, res) => {

    try{

        const {

            dutyId,

            lat,

            lng,

            imageBase64

        } = req.body;

        if(
            !dutyId ||
            !lat ||
            !lng ||
            !imageBase64
        ){

            return res.status(400).json({

                success:false,

                message:"Missing required fields"

            });

        }

        const profile = await FaceProfile.findOne({

            userId:req.user._id

        });

        if(!profile){

            return res.status(404).json({

                success:false,

                message:"Face not registered"

            });

        }

        const flaskResponse = await extractDescriptor(
            imageBase64
        );

        if(!flaskResponse.success){

            return res.status(400).json({

                success:false,

                message:"Unable to detect face"

            });

        }

       const { matched, distance } = isFaceMatched(
            profile.descriptor,
            flaskResponse.descriptor
                );

              

        if (!matched) {
            return res.status(403).json({

                success:false,

                message:"Face verification failed",

                distance

            });

        }

        const backendResponse = await checkIn(

            req.headers.authorization,

            dutyId,

            lat,

            lng

        );

        return res.json(backendResponse);

    }

    catch(err){

        console.log(err);

        return res.status(500).json({

            success:false,

            message:err.message

        });

    }

};

const getFaceStatus = async (req, res) => {
  try {
    const faceProfile = await FaceProfile.findOne({ userId: req.user._id });
    return res.status(200).json({
      success: true,
      data: {
        hasFaceRegistered: !!faceProfile?.descriptor,
        faceRegisteredAt: faceProfile?.updatedAt || faceProfile?.createdAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  registerFace,
  checkInImage,
  getFaceStatus,
};

