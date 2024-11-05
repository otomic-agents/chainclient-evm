const { ethers } = require('ethers');
// 或者在浏览器环境使用
// import { ethers } from 'ethers';

const errors = [
  'ExpiredOp(string,uint64)',
  'FailedToSendEther()',
  'InvalidAmount()',
  'InvalidHashlock()',
  'InvalidRefundTime()',
  'InvalidSender()',
  'InvalidStatus()',
  'NotInOpWindow(string,uint64,uint64)',
  'NotUnlock(string,uint64)'
];

errors.forEach(error => {
  const selector = ethers.utils.id(error).substring(0, 10);
  console.log(`${error}: ${selector}`);
});