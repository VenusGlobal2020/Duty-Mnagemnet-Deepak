from flask import Flask
from routes.face_routes import face_bp
from routes.track_routes import track_bp 

app = Flask(__name__)

app.register_blueprint(face_bp)
app.register_blueprint(track_bp)  


@app.route("/")
def home():
    return {
        "success": True,
        "message": "Flask Face Service Running"
    }


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=4020,
        debug=True
    )