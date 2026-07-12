from flask import Blueprint
from flask import request
from flask import jsonify

from utils.geo_utils import clean_track_points

track_bp = Blueprint("track", __name__)


@track_bp.route("/process-track", methods=["POST"])
def process_track():
    try:
        data = request.get_json()
        points = data.get("points")

        if not points or not isinstance(points, list):
            return jsonify({"success": False, "message": "points array is required"}), 400

        previous_last = data.get("previousLast")
        cleaned, stats = clean_track_points(points, previous_last)

        return jsonify({"success": True, "cleanedPoints": cleaned, "stats": stats})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500