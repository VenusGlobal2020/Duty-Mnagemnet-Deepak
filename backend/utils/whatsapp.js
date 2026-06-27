const axios = require('axios');

const WHATSAPP_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const sendWhatsAppTemplate = async (phone, templateName, components = [], languageCode = 'en') => {
  try {
    const formattedPhone = phone.startsWith('+') ? phone.replace('+', '') : `91${phone}`;
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };
    const response = await axios.post(WHATSAPP_URL, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`WhatsApp send error [${templateName}]:`, errMsg);
    return { success: false, error: errMsg };
  }
};

// ─── Existing Templates ───────────────────────────────────────────────────────

// duty_assigned: {{1}} officer name, {{2}} duty name, {{3}} location, {{4}} start, {{5}} end
const notifyDutyAssigned = async (phone, officerName, dutyName, location, startDate, endDate) => {
  return sendWhatsAppTemplate(phone, 'duty_assigned', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: location },
      { type: 'text', text: new Date(startDate).toLocaleString('en-IN') },
      { type: 'text', text: new Date(endDate).toLocaleString('en-IN') },
    ],
  }]);
};

// duty_cancelled: {{1}} officer name, {{2}} duty name, {{3}} reason
const notifyDutyCancelled = async (phone, officerName, dutyName, reason = 'Administrative decision') => {
  return sendWhatsAppTemplate(phone, 'duty_cancelled', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ],
  }]);
};

// duty_updated: {{1}} officer name, {{2}} duty name, {{3}} what changed
const notifyDutyUpdated = async (phone, officerName, dutyName, changes) => {
  return sendWhatsAppTemplate(phone, 'duty_updated', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: changes },
    ],
  }]);
};

// officer_replaced: {{1}} new officer name, {{2}} duty name, {{3}} reason
const notifyOfficerReplaced = async (phone, newOfficerName, dutyName, reason) => {
  return sendWhatsAppTemplate(phone, 'officer_replaced', [{
    type: 'body',
    parameters: [
      { type: 'text', text: newOfficerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ],
  }]);
};

// duty_rejected: {{1}} operator name, {{2}} officer name, {{3}} duty name, {{4}} reason
const notifyDutyRejected = async (phone, operatorName, officerName, dutyName, reason) => {
  return sendWhatsAppTemplate(phone, 'duty_rejected', [{
    type: 'body',
    parameters: [
      { type: 'text', text: operatorName },
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ],
  }]);
};

// account_suspended: {{1}} name, {{2}} reason
const notifyAccountSuspended = async (phone, name, reason) => {
  return sendWhatsAppTemplate(phone, 'account_suspended', [{
    type: 'body',
    parameters: [
      { type: 'text', text: name },
      { type: 'text', text: reason },
    ],
  }]);
};

// forgot_password_otp: {{1}} name, {{2}} OTP, {{3}} expiry minutes
const sendOTPWhatsApp = async (phone, name, otp) => {
  return sendWhatsAppTemplate(phone, 'forgot_password_otp', [{
    type: 'body',
    parameters: [
      { type: 'text', text: name },
      { type: 'text', text: otp },
      { type: 'text', text: '10' },
    ],
  }]);
};

// welcome_user: {{1}} name, {{2}} role, {{3}} email, {{4}} temp password
const sendWelcomeMessage = async (phone, name, role, email, tempPassword) => {
  return sendWhatsAppTemplate(phone, 'welcome_user', [{
    type: 'body',
    parameters: [
      { type: 'text', text: name },
      { type: 'text', text: role },
      { type: 'text', text: email },
      { type: 'text', text: tempPassword },
    ],
  }]);
};

// ─── New Swap Templates ───────────────────────────────────────────────────────

/**
 * swap_requested — sent to the OPERATOR when an officer submits a swap request.
 * Template params: {{1}} operator name, {{2}} officer name (requesting),
 *                  {{3}} target officer name, {{4}} duty name, {{5}} reason
 */
const notifySwapRequested = async (phone, operatorName, fromOfficerName, toOfficerName, dutyName, reason) => {
  return sendWhatsAppTemplate(phone, 'swap_requested', [{
    type: 'body',
    parameters: [
      { type: 'text', text: operatorName },
      { type: 'text', text: fromOfficerName },
      { type: 'text', text: toOfficerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ],
  }]);
};

/**
 * swap_accepted — sent to the requesting officer when their swap is accepted.
 * Template params: {{1}} officer name, {{2}} duty name, {{3}} decision (accepted/rejected),
 *                  {{4}} operator note
 */
const notifySwapAccepted = async (phone, officerName, dutyName, decision, operatorNote = '') => {
  return sendWhatsAppTemplate(phone, 'swap_decision', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: decision },
      { type: 'text', text: operatorNote || 'N/A' },
    ],
  }]);
};

/**
 * swap_rejected — sent to the requesting officer when their swap is rejected.
 * Template params: {{1}} officer name, {{2}} duty name, {{3}} reason
 */
const notifySwapRejected = async (phone, officerName, dutyName, reason) => {
  return sendWhatsAppTemplate(phone, 'swap_rejected', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ],
  }]);
};

/**
 * swap_executed — sent to the INCOMING officer when a swap puts them on a duty.
 * Template params: {{1}} officer name, {{2}} duty name, {{3}} location,
 *                  {{4}} start date, {{5}} end date, {{6}} reason/note
 */
const notifySwapExecuted = async (phone, officerName, dutyName, location, startDate, endDate, note = '') => {
  return sendWhatsAppTemplate(phone, 'swap_executed', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: location },
      { type: 'text', text: new Date(startDate).toLocaleString('en-IN') },
      { type: 'text', text: new Date(endDate).toLocaleString('en-IN') },
      { type: 'text', text: note || 'Assigned via swap' },
    ],
  }]);
};

/**
 * swap_removed — sent to the OUTGOING officer in a 'move' swap, where they
 * are taken off a duty but NOT placed on another one (the target officer
 * was free, so it's a one-way handover, not a two-way exchange).
 * Template params: {{1}} officer name, {{2}} duty name, {{3}} reason/note
 */
const notifySwapRemoved = async (phone, officerName, dutyName, note = '') => {
  return sendWhatsAppTemplate(phone, 'swap_removed', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: note || 'You have been swapped out by the operator' },
    ],
  }]);
};

/**
 * swap_cancelled — sent to the OPERATOR when an officer withdraws their own
 * pending swap request before any decision was made.
 * Template params: {{1}} operator name, {{2}} officer name, {{3}} duty name
 */
const notifySwapCancelled = async (phone, operatorName, officerName, dutyName) => {
  return sendWhatsAppTemplate(phone, 'swap_cancelled', [{
    type: 'body',
    parameters: [
      { type: 'text', text: operatorName },
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
    ],
  }]);
};

module.exports = {
  sendWhatsAppTemplate,
  notifyDutyAssigned,
  notifyDutyCancelled,
  notifyDutyUpdated,
  notifyOfficerReplaced,
  notifyDutyRejected,
  notifyAccountSuspended,
  sendOTPWhatsApp,
  sendWelcomeMessage,
  // Swap notifications
  notifySwapRequested,
  notifySwapAccepted,
  notifySwapRejected,
  notifySwapExecuted,
  notifySwapRemoved,
  notifySwapCancelled,
};