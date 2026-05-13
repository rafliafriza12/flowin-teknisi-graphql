import authService from "./authService";
import emailService from "./emailService";
import userService from "./userService";
import workOrderService from "./workOrderService";
import paymentService from "./paymentService";
import laporanService from "./laporanService";
// push notifications removed - replaced by email notifications

const services = {
  authService,
  emailService,
  userService,
  workOrderService,
  paymentService,
  laporanService,
  // pushNotificationService removed
};

export default services;
