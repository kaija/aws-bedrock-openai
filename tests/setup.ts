// Jest setup file
import 'jest';

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.ENVIRONMENT = 'test';
process.env.LOG_LEVEL = 'ERROR';

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  InvokeModelCommand: jest.fn(),
  ConverseCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetParameterCommand: jest.fn(),
  GetParametersCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetCallerIdentityCommand: jest.fn()
}));

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};