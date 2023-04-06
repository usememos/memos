const getResourceDataSet = {
  dataset: [
    {
      data: {
        data: [
          {
            id: 1,
            creatorId: 1,
            createdTs: 1677717671,
            updatedTs: 1677717671,
            filename: "CS_2023-03-02_at_08.41.03@2x.png",
            externalLink: "",
            type: "image/png",
            size: 48357,
            visibility: "",
            linkedMemoAmount: 1,
          },
        ],
      },
      expect: [
        {
          id: 1,
          creatorId: 1,
          createdTs: 1677717671000,
          updatedTs: 1677717671000,
          filename: "CS_2023-03-02_at_08.41.03@2x.png",
          externalLink: "",
          type: "image/png",
          size: 48357,
          visibility: "",
          linkedMemoAmount: 1,
        },
      ],
    },
    {
      data: {
        data: [
          {
            id: 3,
            creatorId: 101,
            createdTs: 1680604140,
            updatedTs: 1680604140,
            filename: "11111wc_20230330_d20230402.mp4",
            internalPath: "/usr/local/memos/11111wc_20230330_d20230402.mp4",
            externalLink: "",
            type: "video/mp4",
            size: 3639822,
            linkedMemoAmount: 1,
          },
          {
            id: 2,
            creatorId: 101,
            createdTs: 1680604075,
            updatedTs: 1680604075,
            filename: "ChatGPT-18-23-49.jpg",
            internalPath: "/usr/local/memos/ChatGPT-18-23-49.jpg",
            externalLink: "",
            type: "image/jpeg",
            size: 546179,
            linkedMemoAmount: 1,
          },
        ],
      },
      expect: [
        {
          id: 3,
          creatorId: 101,
          createdTs: 1680604140000,
          updatedTs: 1680604140000,
          filename: "11111wc_20230330_d20230402.mp4",
          internalPath: "/usr/local/memos/11111wc_20230330_d20230402.mp4",
          externalLink: "",
          type: "video/mp4",
          size: 3639822,
          linkedMemoAmount: 1,
        },
        {
          id: 2,
          creatorId: 101,
          createdTs: 1680604075000,
          updatedTs: 1680604075000,
          filename: "ChatGPT-18-23-49.jpg",
          internalPath: "/usr/local/memos/ChatGPT-18-23-49.jpg",
          externalLink: "",
          type: "image/jpeg",
          size: 546179,
          linkedMemoAmount: 1,
        },
      ],
    },
  ],
};

export { getResourceDataSet };
