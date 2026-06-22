const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/response');

// @desc   Get notifications for logged-in user
// @route  GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const query = { recipientRef: req.user._id };
  if (unreadOnly === 'true') query.isRead = false;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipientRef: req.user._id, isRead: false })
  ]);

  return successResponse(res, 200, 'Notifications fetched', {
    notifications,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    unreadCount
  });
});

// @desc   Mark as read
// @route  PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientRef: req.user._id },
    { isRead: true, readAt: new Date() }
  );
  return successResponse(res, 200, 'Marked as read');
});

// @desc   Mark all as read
// @route  PATCH /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipientRef: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return successResponse(res, 200, 'All notifications marked as read');
});

// @desc   Delete notification
// @route  DELETE /api/notifications/:id
const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipientRef: req.user._id });
  return successResponse(res, 200, 'Notification deleted');
});

module.exports = { getNotifications, markRead, markAllRead, deleteNotification };
