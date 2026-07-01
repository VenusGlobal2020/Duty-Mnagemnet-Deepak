const asyncHandler = require('express-async-handler');
const DutyType = require('../models/DutyType');
const Rank = require('../models/Rank');
const { successResponse, errorResponse } = require('../utils/response');

// Only regular operators define/manage duty type templates.
const requireRegular = (req, res) => {
  if (req.user.role !== 'operator_regular') {
    errorResponse(res, 403, 'Only regular operators can manage duty types');
    return false;
  }
  return true;
};

// @desc   Create a duty type template
// @route  POST /api/operator/duty-types
const createDutyType = asyncHandler(async (req, res) => {
  if (!requireRegular(req, res)) return;

  const { name, description, rankRequirements } = req.body;
  if (!name || !name.trim()) return errorResponse(res, 400, 'Name is required');

  const parsed = typeof rankRequirements === 'string' ? JSON.parse(rankRequirements) : rankRequirements;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return errorResponse(res, 400, 'At least one rank requirement is required');
  }
  for (const r of parsed) {
    if (!r.rankRef || !r.count || r.count < 1) {
      return errorResponse(res, 400, 'Each rank requirement needs a rank and a count of at least 1');
    }
  }

  const dutyType = await DutyType.create({
    name: name.trim(),
    description: description || '',
    rankRequirements: parsed.map(r => ({ rankRef: r.rankRef, count: parseInt(r.count) })),
    operatorRef: req.user._id,
    adminRef: req.user.adminRef,
  });

  return successResponse(res, 201, 'Duty type created', { dutyType });
});

// @desc   List duty types created by this operator
// @route  GET /api/operator/duty-types
const getDutyTypes = asyncHandler(async (req, res) => {
  if (!requireRegular(req, res)) return;

  const dutyTypes = await DutyType.find({ operatorRef: req.user._id, isActive: true })
    .populate('rankRequirements.rankRef', 'name code color')
    .sort({ name: 1 });

  return successResponse(res, 200, 'Duty types fetched', { dutyTypes });
});

// @desc   Update a duty type template
// @route  PUT /api/operator/duty-types/:dutyTypeId
const updateDutyType = asyncHandler(async (req, res) => {
  if (!requireRegular(req, res)) return;

  const dutyType = await DutyType.findOne({ _id: req.params.dutyTypeId, operatorRef: req.user._id });
  if (!dutyType) return errorResponse(res, 404, 'Duty type not found');

  const { name, description, rankRequirements } = req.body;
  if (name !== undefined) dutyType.name = name.trim();
  if (description !== undefined) dutyType.description = description;

  if (rankRequirements !== undefined) {
    const parsed = typeof rankRequirements === 'string' ? JSON.parse(rankRequirements) : rankRequirements;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return errorResponse(res, 400, 'At least one rank requirement is required');
    }
    for (const r of parsed) {
      if (!r.rankRef || !r.count || r.count < 1) {
        return errorResponse(res, 400, 'Each rank requirement needs a rank and a count of at least 1');
      }
    }
    dutyType.rankRequirements = parsed.map(r => ({ rankRef: r.rankRef, count: parseInt(r.count) }));
  }

  await dutyType.save();
  return successResponse(res, 200, 'Duty type updated', { dutyType });
});

// @desc   Delete (soft) a duty type template
// @route  DELETE /api/operator/duty-types/:dutyTypeId
const deleteDutyType = asyncHandler(async (req, res) => {
  if (!requireRegular(req, res)) return;

  const dutyType = await DutyType.findOne({ _id: req.params.dutyTypeId, operatorRef: req.user._id });
  if (!dutyType) return errorResponse(res, 404, 'Duty type not found');

  // Soft-delete — duties already created from this template keep their own
  // snapshot of rankRequirements, so this is safe to hide without breaking them.
  dutyType.isActive = false;
  await dutyType.save();

  return successResponse(res, 200, 'Duty type deleted');
});

module.exports = { createDutyType, getDutyTypes, updateDutyType, deleteDutyType };