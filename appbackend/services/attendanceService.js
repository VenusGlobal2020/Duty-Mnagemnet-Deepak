const axios = require("axios");

const BACKEND_URL =
    process.env.BACKEND_URL || "http://localhost:5000";

async function checkIn(token, dutyId, lat, lng) {

    try {

        const response = await axios.post(

            `${BACKEND_URL}/api/attendance/checkin`,

            {
                dutyId,
                lat,
                lng
            },

            {

                headers:{

                    Authorization:token
                }

            }

        );

        return response.data;

    }

    catch(err){

        if(err.response){

            throw new Error(err.response.data.message);

        }

        throw err;

    }

}

module.exports={

    checkIn

};