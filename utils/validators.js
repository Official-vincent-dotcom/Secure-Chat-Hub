const validator = require('validator');

class Validators {
  static validateEmail(email) {
    return validator.isEmail(email);
  }

  static validatePassword(password) {
    // At least 6 characters
    return password && password.length >= 6;
  }

  static validateUsername(username) {
    // Alphanumeric and underscores, 3-20 characters
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username);
  }

  static sanitizeString(str) {
    return validator.trim(str);
  }

  static validateRoomName(name) {
    return name && name.length >= 2 && name.length <= 50;
  }
}

module.exports = Validators;