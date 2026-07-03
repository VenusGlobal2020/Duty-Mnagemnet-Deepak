import base64
import cv2
import numpy as np


def base64_to_image(image_base64):

    # Remove data:image/jpeg;base64, if present
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    image_bytes = base64.b64decode(image_base64)

    np_array = np.frombuffer(image_bytes, np.uint8)

    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    return image