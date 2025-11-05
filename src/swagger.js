const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Money Map API',
      version: '1.0.0',
      description: '간단한 수입/지출 관리 API'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local server' }
    ]
  },
  // API 라우트 파일에서 JSDoc 주석을 읽도록 경로를 지정
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;