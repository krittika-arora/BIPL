// An error that carries the HTTP status the error handler should respond with.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }

  // A request that is well-formed but breaks a business rule (illegal transition, publish guard...).
  static ruleViolation(message) {
    return new HttpError(409, message);
  }

  static isRuleViolation(err) {
    return err instanceof HttpError && err.status === 409;
  }
}

module.exports = HttpError;
