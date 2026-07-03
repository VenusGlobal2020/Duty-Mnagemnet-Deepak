const successResponse = (res, statusCode = 200, message = 'Success', data = {}) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const errorResponse = (res, statusCode = 500, message = 'Server Error', errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const paginateQuery = async (Model, query, page, limit, populate = '', sort = { createdAt: -1 }) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    Model.find(query).sort(sort).skip(skip).limit(limitNum).populate(populate),
    Model.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1
    }
  };
};

module.exports = { successResponse, errorResponse, paginateQuery };
