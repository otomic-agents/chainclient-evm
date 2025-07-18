import needle from "needle";
import retry from 'async-retry';
import Monitor from "../monitor/Monitor";
import { EvmConfig, FilterInfo } from "../interface/interface";
import { SystemOut } from "../utils/systemOut";
import { UUIDGenerator } from "../utils/comm";
import { SystemBus } from "../bus/bus";
import _ from "lodash";

const createCallback = (
  url: string,
  type: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  return async (event: any) => {
    event.type = type;
    switch (type) {
      case "TransferOut":
        event.eventParse.transfer_id = event.eventParse.transferId;
        event.eventParse.dst_chain_id = event.eventParse.dstChainId;
        event.eventParse.bid_id = event.eventParse.bidId;
        event.eventParse.dst_address = event.eventParse.dstAddress;
        event.eventParse.hash_lock = event.eventParse.hashlock;
        event.eventParse.dst_token = event.eventParse.tokenDst;
        event.eventParse.dst_amount = event.eventParse.amountDst;
        event.eventParse.agreement_reached_time =
          event.eventParse.agreementReachedTime;
        event.eventParse.expected_single_step_time = event.eventParse.expectedSingleStepTime;
        event.eventParse.tolerant_single_step_time = event.eventParse.tolerantSingleStepTime;
        event.eventParse.earliest_refund_time = event.eventParse.earliestRefundTime;
        break;
      case "TransferIn":
        event.eventParse.transfer_id = event.eventParse.transferId;
        event.eventParse.hash_lock = event.eventParse.hashlock;
        event.eventParse.src_chain_id = event.eventParse.srcChainId;
        event.eventParse.src_transfer_id = event.eventParse.srcTransferId;
        event.eventParse.agreement_reached_time =
          event.eventParse.agreementReachedTime;
        event.eventParse.expected_single_step_time = event.eventParse.expectedSingleStepTime;
        event.eventParse.tolerant_single_step_time = event.eventParse.tolerantSingleStepTime;
        event.eventParse.earliest_refund_time = event.eventParse.earliestRefundTime;
        break;
      case "ConfirmOut":
        event.eventParse.transfer_id = event.eventParse.transferId;
        break;
      case "ConfirmIn":
        event.eventParse.transfer_id = event.eventParse.transferId;
        break;
      case "RefundOut":
        event.eventParse.transfer_id = event.eventParse.transferId;
        break;
      case "RefundIn":
        event.eventParse.transfer_id = event.eventParse.transferId;
        break;
      case "Reputation":
        event.eventParse.transfer_id = event.eventParse.transferId;
        break;
      default:
        break;
    }
    event.transfer_info = JSON.stringify(event.tx);
    event.event_raw = JSON.stringify(event.event);
    event.event_parse = event.eventParse;
    event.chain_id = config.system_chain_id;

    SystemOut.info(`[key point] on event callback: type [${type}]`);
    SystemOut.info(JSON.stringify(event));
    SystemBus.sendAction({ action: "chain_event", payload: _.clone(event) })

    if (merge) {
      mergeData(event);
      return;
    }

    retry(async () => {
      SystemOut.info(`[key point] notify event`, url)
      await needle('post', url,
        event,
        {
          headers: {
            "Content-Type": "application/json",
          },
        })
    }, {
      retries: 10,
      minTimeout: 1000, // 1 second
      maxTimeout: Infinity,
      onRetry: (error: any, attempt: any) => {
        SystemOut.info(`attempt ${attempt}`);
        SystemOut.error(error)
      },
    });
  };
};

export const watchTransferOut = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_address,
    topic_string: config.transfer_out.topic_string,
    event_data: config.transfer_out.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "TransferOut", config, merge, mergeData),
    {
      TransferOut: url,
      TransferIn: undefined,
      Confirm: undefined,
      Refund: undefined,
      Reputation: undefined,
    }
  );
  return filter_info.filter_id
};

export const watchTransferIn = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_address,
    topic_string: config.transfer_in.topic_string,
    event_data: config.transfer_in.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "TransferIn", config, merge, mergeData),
    {
      TransferIn: url,
      TransferOut: undefined,
      Confirm: undefined,
      Refund: undefined,
      Reputation: undefined,
    }
  );
  return filter_info.filter_id
};

export const watchConfirmOut = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_address,
    topic_string: config.confirm_out.topic_string,
    event_data: config.confirm_out.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "ConfirmOut", config, merge, mergeData),
    {
      Confirm: url,
      TransferOut: undefined,
      TransferIn: undefined,
      Refund: undefined,
      Reputation: undefined,
    }
  );
  return filter_info.filter_id
};

export const watchConfirmIn = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_address,
    topic_string: config.confirm_in.topic_string,
    event_data: config.confirm_in.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "ConfirmIn", config, merge, mergeData),
    {
      Confirm: url,
      TransferOut: undefined,
      TransferIn: undefined,
      Refund: undefined,
      Reputation: undefined,
    }
  );
  return filter_info.filter_id
};

export const watchRefundOut = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_address,
    topic_string: config.refunded_out.topic_string,
    event_data: config.refunded_out.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "RefundOut", config, merge, mergeData),
    {
      Refund: url,
      TransferOut: undefined,
      TransferIn: undefined,
      Confirm: undefined,
      Reputation: undefined,
    }
  );
  return filter_info.filter_id
};

export const watchRefundIn = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_address,
    topic_string: config.refunded_in.topic_string,
    event_data: config.refunded_in.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "RefundIn", config, merge, mergeData),
    {
      Refund: url,
      TransferOut: undefined,
      TransferIn: undefined,
      Confirm: undefined,
      Reputation: undefined,
    }
  );
  return filter_info.filter_id
};

export const watchReputation = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
): string => {
  const filter_info: FilterInfo = {
    filter_id: UUIDGenerator.generateUUID(),
    contract_address: config.contract_reputation,
    topic_string: config.submit_complaint.topic_string,
    event_data: config.submit_complaint.event_data,
  };

  monitor.watch(
    filter_info,
    createCallback(url, "Reputation", config, merge, mergeData),
    {
      Reputation: url,
      TransferOut: undefined,
      TransferIn: undefined,
      Confirm: undefined,
      Refund: undefined,
    }
  );
  return filter_info.filter_id
};
