from flask import Blueprint
from flask import request
from flask import jsonify

from utils.image_utils import base64_to_image
from services.face_service import extract_descriptor

face_bp = Blueprint(
    "face",
    __name__
)


@face_bp.route(
    "/extract-face",
    methods=["POST"]
)
def extract_face():

    try:

        data = request.get_json()

        image_base64 = data.get("imageBase64")

        if not image_base64:

            return jsonify({

                "success":False,

                "message":"imageBase64 is required"

            }),400

        image = base64_to_image(
            image_base64
        )

        descriptor = extract_descriptor(
            image
        )

        if descriptor is None:

            return jsonify({

                "success":False,

                "message":"No face detected"

            }),400

        return jsonify({

            "success":True,

            "descriptor":descriptor

        })

    except Exception as e:

        return jsonify({

            "success":False,

            "message":str(e)

        }),500