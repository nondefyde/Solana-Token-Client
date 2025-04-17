/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/admin.json`.
 */
export type Admin = {
  "address": "HpB6fKQKWVHxpw2ApduNeJfqdVjTS4Yk4mUM8stwvXdf",
  "metadata": {
    "name": "admin",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "disableEmergencyFreeze",
      "discriminator": [
        124,
        71,
        23,
        145,
        132,
        67,
        73,
        208
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "enableEmergencyFreeze",
      "discriminator": [
        234,
        125,
        147,
        222,
        217,
        140,
        14,
        75
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "settings",
          "type": {
            "defined": {
              "name": "settings"
            }
          }
        }
      ]
    },
    {
      "name": "updateAdminList",
      "discriminator": [
        214,
        42,
        207,
        113,
        213,
        102,
        28,
        33
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "adminToAdd",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "adminToRemove",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "updateCategory",
      "discriminator": [
        249,
        192,
        204,
        253,
        57,
        132,
        107,
        44
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "field",
          "type": {
            "defined": {
              "name": "categoryUpdate"
            }
          }
        }
      ]
    },
    {
      "name": "updatePlatformAccounts",
      "discriminator": [
        191,
        139,
        158,
        186,
        228,
        21,
        99,
        55
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  100,
                  109,
                  105,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "platformAccounts",
          "type": {
            "defined": {
              "name": "platformSetting"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "adminSettings",
      "discriminator": [
        72,
        250,
        196,
        91,
        93,
        154,
        17,
        15
      ]
    }
  ],
  "events": [
    {
      "name": "adminSettingsUpdated",
      "discriminator": [
        160,
        171,
        97,
        2,
        251,
        177,
        132,
        44
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6001,
      "name": "alreadyTransferable",
      "msg": "Token is already transferable"
    },
    {
      "code": 6002,
      "name": "onlyMainAdminAllowed",
      "msg": "Only the main admin is allowed to perform this action"
    },
    {
      "code": 6003,
      "name": "cannotRemoveMainAuthority",
      "msg": "Cannot remove the main authority from admin list"
    },
    {
      "code": 6004,
      "name": "invalidPercentage",
      "msg": "Invalid percentage value, must be between 0 and 100"
    },
    {
      "code": 6005,
      "name": "invalidBasisPoints",
      "msg": "Invalid basis points value, must be between 0 and 10000"
    },
    {
      "code": 6006,
      "name": "invalidRange",
      "msg": "Invalid range: min must be less than max"
    },
    {
      "code": 6007,
      "name": "programMismatch",
      "msg": "Program mismatch: only the initializing program can update settings"
    },
    {
      "code": 6008,
      "name": "emergencyFreezeActive",
      "msg": "Emergency freeze is active, operations restricted"
    },
    {
      "code": 6009,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic operation overflowed"
    },
    {
      "code": 6010,
      "name": "insufficientFunds",
      "msg": "Insufficient funds for token creation"
    },
    {
      "code": 6011,
      "name": "requiredAccountNotFound",
      "msg": "Required account not found in remaining accounts"
    },
    {
      "code": 6012,
      "name": "invalidAccountInput",
      "msg": "Invalid account provided as input"
    },
    {
      "code": 6013,
      "name": "invalidFeeAccount",
      "msg": "Invalid fee account - must match the one in admin settings"
    },
    {
      "code": 6014,
      "name": "invalidLotteryAccount",
      "msg": "Invalid lottery account - must match the one in admin settings"
    },
    {
      "code": 6015,
      "name": "raydiumPoolCreationFailed",
      "msg": "Raydium pool creation failed"
    },
    {
      "code": 6016,
      "name": "raydiumLiquidityAdditionFailed",
      "msg": "Liquidity addition to Raydium pool failed"
    },
    {
      "code": 6017,
      "name": "dexMigrationAlreadyCompleted",
      "msg": "DEX migration already completed"
    },
    {
      "code": 6018,
      "name": "tokenProgramError",
      "msg": "Token program CPI failed"
    }
  ],
  "types": [
    {
      "name": "adminSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mainAuthority",
            "type": "pubkey"
          },
          {
            "name": "adminAddresses",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "lotterySettings",
            "type": {
              "defined": {
                "name": "lotterySettings"
              }
            }
          },
          {
            "name": "tokenSettings",
            "type": {
              "defined": {
                "name": "tokenSettings"
              }
            }
          },
          {
            "name": "stakeSettings",
            "type": {
              "defined": {
                "name": "stakeSettings"
              }
            }
          },
          {
            "name": "referralSettings",
            "type": {
              "defined": {
                "name": "referralSettings"
              }
            }
          },
          {
            "name": "platformAccounts",
            "type": {
              "defined": {
                "name": "platformAccounts"
              }
            }
          },
          {
            "name": "initializingProgram",
            "type": "pubkey"
          },
          {
            "name": "emergencyFreezeActive",
            "type": "bool"
          },
          {
            "name": "emergencyFreezeTime",
            "type": "i64"
          },
          {
            "name": "emergencyFreezeAuthority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "adminSettingsUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateType",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "tokenSettings",
            "type": {
              "defined": {
                "name": "tokenSettings"
              }
            }
          },
          {
            "name": "lotterySettings",
            "type": {
              "defined": {
                "name": "lotterySettings"
              }
            }
          },
          {
            "name": "stakeSettings",
            "type": {
              "defined": {
                "name": "stakeSettings"
              }
            }
          },
          {
            "name": "referralSettings",
            "type": {
              "defined": {
                "name": "referralSettings"
              }
            }
          },
          {
            "name": "platformAccounts",
            "type": {
              "defined": {
                "name": "platformAccounts"
              }
            }
          },
          {
            "name": "emergencyFreezeActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "buyActionSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "solsPerTicket",
            "type": "u64"
          },
          {
            "name": "maxTicketsPerBuy",
            "type": "u16"
          },
          {
            "name": "maxTicketsPerCycle",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "buyActionUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "solsPerTicket",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxTicketsPerBuy",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "maxTicketsPerCycle",
            "type": {
              "option": "u32"
            }
          }
        ]
      }
    },
    {
      "name": "categoryUpdate",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "type": {
              "option": {
                "defined": {
                  "name": "tokenUpdateFields"
                }
              }
            }
          },
          {
            "name": "lottery",
            "type": {
              "option": {
                "defined": {
                  "name": "lotteryUpdateFields"
                }
              }
            }
          },
          {
            "name": "stake",
            "type": {
              "option": {
                "defined": {
                  "name": "stakeUpdateFields"
                }
              }
            }
          },
          {
            "name": "referral",
            "type": {
              "option": {
                "defined": {
                  "name": "referralUpdateFields"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "createActionSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketCapThreshold",
            "type": "u64"
          },
          {
            "name": "ticketsPerCreation",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "createActionUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketCapThreshold",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ticketsPerCreation",
            "type": {
              "option": "u16"
            }
          }
        ]
      }
    },
    {
      "name": "lotterySettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ticketRangeMin",
            "type": "u32"
          },
          {
            "name": "ticketRangeMax",
            "type": "u32"
          },
          {
            "name": "winnersPerCycle",
            "type": "u8"
          },
          {
            "name": "marketingPercentage",
            "type": "u8"
          },
          {
            "name": "cycleDurationHours",
            "type": "u32"
          },
          {
            "name": "createAction",
            "type": {
              "defined": {
                "name": "createActionSettings"
              }
            }
          },
          {
            "name": "buyAction",
            "type": {
              "defined": {
                "name": "buyActionSettings"
              }
            }
          },
          {
            "name": "sellAction",
            "type": {
              "defined": {
                "name": "sellActionSettings"
              }
            }
          }
        ]
      }
    },
    {
      "name": "lotteryUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ticketRangeMin",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "ticketRangeMax",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "winnersPerCycle",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "marketingPercentage",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "cycleDurationHours",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "createAction",
            "type": {
              "option": {
                "defined": {
                  "name": "createActionUpdateFields"
                }
              }
            }
          },
          {
            "name": "buyAction",
            "type": {
              "option": {
                "defined": {
                  "name": "buyActionUpdateFields"
                }
              }
            }
          },
          {
            "name": "sellAction",
            "type": {
              "option": {
                "defined": {
                  "name": "sellActionUpdateFields"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "platformAccounts",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeAccount",
            "type": "pubkey"
          },
          {
            "name": "lotteryAccount",
            "type": "pubkey"
          },
          {
            "name": "marketingAccount",
            "type": "pubkey"
          },
          {
            "name": "treasuryAccount",
            "type": "pubkey"
          },
          {
            "name": "hookProgram",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "platformSetting",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeAccount",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "lotteryAccount",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "marketingAccount",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "treasuryAccount",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "hookProgram",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "referralSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "downlineTicketPercentage",
            "type": "u8"
          },
          {
            "name": "multiplierPercentage",
            "type": "u8"
          },
          {
            "name": "downlinesPerMultiplier",
            "type": "u8"
          },
          {
            "name": "expirationDays",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "referralUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "downlineTicketPercentage",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "multiplierPercentage",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "downlinesPerMultiplier",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "expirationDays",
            "type": {
              "option": "u16"
            }
          }
        ]
      }
    },
    {
      "name": "sellActionSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ticketLossPercentage",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sellActionUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ticketLossPercentage",
            "type": {
              "option": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "settings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lotterySettings",
            "type": {
              "defined": {
                "name": "lotterySettings"
              }
            }
          },
          {
            "name": "tokenSettings",
            "type": {
              "defined": {
                "name": "tokenSettings"
              }
            }
          },
          {
            "name": "stakeSettings",
            "type": {
              "defined": {
                "name": "stakeSettings"
              }
            }
          },
          {
            "name": "referralSettings",
            "type": {
              "defined": {
                "name": "referralSettings"
              }
            }
          },
          {
            "name": "platformAccounts",
            "type": {
              "defined": {
                "name": "platformAccounts"
              }
            }
          }
        ]
      }
    },
    {
      "name": "stakeSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ticketBoostPercentage",
            "type": "u8"
          },
          {
            "name": "tokensPerBoost",
            "type": "u64"
          },
          {
            "name": "maxBoostCapPercentage",
            "type": "u8"
          },
          {
            "name": "unstakePenaltyPercentage",
            "type": "u8"
          },
          {
            "name": "minStakeDurationHours",
            "type": "u32"
          },
          {
            "name": "boostTiersEnabled",
            "type": "bool"
          },
          {
            "name": "compoundBoost",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "stakeUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ticketBoostPercentage",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "tokensPerBoost",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxBoostCapPercentage",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "unstakePenaltyPercentage",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "minStakeDurationHours",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "boostTiersEnabled",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "compoundBoost",
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "tokenSettings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creationFee",
            "type": "u64"
          },
          {
            "name": "dexFeePercentage",
            "type": "u16"
          },
          {
            "name": "feeBasisPoints",
            "type": "u16"
          },
          {
            "name": "virtualSolAmount",
            "type": "u64"
          },
          {
            "name": "defaultTokenSupply",
            "type": "u64"
          },
          {
            "name": "marketCapThreshold",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenUpdateFields",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creationFee",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "dexFeePercentage",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "feeBasisPoints",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "virtualSolAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "defaultTokenSupply",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "marketCapThreshold",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    }
  ]
};
