function euclideanDistance(a, b) {

    if (!a || !b)
        return Number.MAX_VALUE;

    if (!Array.isArray(a) || !Array.isArray(b))
        return Number.MAX_VALUE;

    if (a.length !== b.length)
        return Number.MAX_VALUE;

    let sum = 0;

    for (let i = 0; i < a.length; i++) {

        const diff = a[i] - b[i];

        sum += diff * diff;

    }

    return Math.sqrt(sum);

}

function isFaceMatched(storedDescriptor, currentDescriptor) {

    const distance = euclideanDistance(
        storedDescriptor,
        currentDescriptor
    );

    // For normalized embeddings, same person typically < 1.0
    return {
        matched: distance <= 1.0,
        distance
    };

}

module.exports = {
    euclideanDistance,
    isFaceMatched
};