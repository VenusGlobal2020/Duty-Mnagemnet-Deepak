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

// ─── Template Helpers ───────────────────────────────────────────────────────

// duty_assigned: {{1}} = officer name, {{2}} = duty name, {{3}} = location, {{4}} = start date, {{5}} = end date
const notifyDutyAssigned = async (phone, officerName, dutyName, location, startDate, endDate) => {
  return sendWhatsAppTemplate(phone, 'duty_assigned', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: location },
      { type: 'text', text: new Date(startDate).toLocaleString('en-IN') },
      { type: 'text', text: new Date(endDate).toLocaleString('en-IN') },
    ]
  }]);
};

// duty_cancelled: {{1}} = officer name, {{2}} = duty name, {{3}} = reason
const notifyDutyCancelled = async (phone, officerName, dutyName, reason = 'Administrative decision') => {
  return sendWhatsAppTemplate(phone, 'duty_cancelled', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ]
  }]);
};

// duty_updated: {{1}} = officer name, {{2}} = duty name, {{3}} = what changed
const notifyDutyUpdated = async (phone, officerName, dutyName, changes) => {
  return sendWhatsAppTemplate(phone, 'duty_updated', [{
    type: 'body',
    parameters: [
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: changes },
    ]
  }]);
};

// officer_replaced: {{1}} = new officer name, {{2}} = duty name, {{3}} = reason
const notifyOfficerReplaced = async (phone, newOfficerName, dutyName, reason) => {
  return sendWhatsAppTemplate(phone, 'officer_replaced', [{
    type: 'body',
    parameters: [
      { type: 'text', text: newOfficerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ]
  }]);
};

// duty_rejected: {{1}} = operator name, {{2}} = officer name, {{3}} = duty name, {{4}} = reason
// Sent to the OPERATOR so they immediately know they need to assign a replacement.
const notifyDutyRejected = async (phone, operatorName, officerName, dutyName, reason) => {
  return sendWhatsAppTemplate(phone, 'duty_rejected', [{
    type: 'body',
    parameters: [
      { type: 'text', text: operatorName },
      { type: 'text', text: officerName },
      { type: 'text', text: dutyName },
      { type: 'text', text: reason },
    ]
  }]);
};

// account_suspended: {{1}} = name, {{2}} = reason
const notifyAccountSuspended = async (phone, name, reason) => {
  return sendWhatsAppTemplate(phone, 'account_suspended', [{
    type: 'body',
    parameters: [
      { type: 'text', text: name },
      { type: 'text', text: reason },
    ]
  }]);
};

// forgot_password_otp: {{1}} = name, {{2}} = OTP, {{3}} = expiry minutes
const sendOTPWhatsApp = async (phone, name, otp) => {
  return sendWhatsAppTemplate(phone, 'forgot_password_otp', [{
    type: 'body',
    parameters: [
      { type: 'text', text: name },
      { type: 'text', text: otp },
      { type: 'text', text: '10' },
    ]
  }]);
};

// welcome_user: {{1}} = name, {{2}} = role, {{3}} = email, {{4}} = temp password
const sendWelcomeMessage = async (phone, name, role, email, tempPassword) => {
  return sendWhatsAppTemplate(phone, 'welcome_user', [{
    type: 'body',
    parameters: [
      { type: 'text', text: name },
      { type: 'text', text: role },
      { type: 'text', text: email },
      { type: 'text', text: tempPassword },
    ]
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
};