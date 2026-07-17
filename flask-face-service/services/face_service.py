import insightface
import numpy as np

app = insightface.app.FaceAnalysis(
    name="buffalo_s"
)

app.prepare(
    ctx_id=0,
    det_size=(320,320)
)


def extract_descriptor(image):

    faces = app.get(image)

    if len(faces) == 0:

        return None

    face = faces[0]

    embedding = face.embedding

    # Normalize to unit vector — required for consistent distance comparison
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()