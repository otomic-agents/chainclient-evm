import needle from "needle";
import retry from 'async-retry';
import Monitor from "../monitor/Monitor";
import { EvmConfig, FilterInfo } from "../interface/interface";
import { systemOutput } from "../utils/systemOutput";

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
        // event.eventParse.time_lock = event.eventParse.timelock
        event.eventParse.dst_token = event.eventParse.tokenDst;
        event.eventParse.dst_amount = event.eventParse.amountDst;
        event.eventParse.agreement_reached_time =
          event.eventParse.agreementReachedTime;
        event.eventParse.step_time_lock = event.eventParse.stepTimelock;
        break;
      case "TransferIn":
        event.eventParse.transfer_id = event.eventParse.transferId;
        event.eventParse.hash_lock = event.eventParse.hashlock;
        // event.eventParse.time_lock = event.eventParse.timelock
        event.eventParse.src_chain_id = event.eventParse.srcChainId;
        event.eventParse.src_transfer_id = event.eventParse.srcTransferId;
        event.eventParse.agreement_reached_time =
          event.eventParse.agreementReachedTime;
        event.eventParse.step_time_lock = event.eventParse.stepTimelock;
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

    systemOutput.debug(`[key point] on event callback: type [${type}]`);
    systemOutput.debug(event);
    

    if (merge) {
      mergeData(event);
      return;
    }

    retry(async () => {
        systemOutput.debug(`[key point] notify event`, url)
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
        onRetry: (error, attempt) => {
            systemOutput.debug(`attempt ${attempt}`);
            systemOutput.error(error)
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
) => {
  const filter_info: FilterInfo = {
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
};

export const watchTransferIn = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  const filter_info: FilterInfo = {
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
};

export const watchConfirmOut = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  const filter_info: FilterInfo = {
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
};

export const watchConfirmIn = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  const filter_info: FilterInfo = {
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
};

export const watchRefundOut = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  const filter_info: FilterInfo = {
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
};

export const watchRefundIn = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  const filter_info: FilterInfo = {
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
};

export const watchReputation = (
  monitor: Monitor,
  url: string,
  config: EvmConfig,
  merge: boolean,
  mergeData: Function
) => {
  const filter_info: FilterInfo = {
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
};
