export const wcClient = {
  pair: async (_uri: string) => {},
  respondSuccess: async (_id: number, _topic: string, _result: string) => {},
  respondError: async (
    _id: number,
    _topic: string,
    _code: number,
    _msg: string,
  ) => {},
  disconnect: async (_topic: string) => {},
  resetClient: () => {},
};
