export const previewScene = {
  'playerVersion': {
    'web': '1.5.2',
    'native': '1.5.2',
  },
  'images': [],
  'fonts': [],
  'version': '3.0',
  'shapes': [],
  'plugins': ['model'],
  'type': 'ge',
  'compositions': [
    {
      'id': '1',
      'name': '新建合成1',
      'duration': 10,
      'startTime': 0,
      'endBehavior': 1,
      'previewSize': [
        750,
        1624,
      ],
      'items': [
        {
          'id': 'ceaa0ba9bf204438ac74bc8840f332b8',
        },
        {
          'id': '5d2ea6f25e2b40308d824d6db9c89661',
        },
        {
          'id': 'b570cb441387e98916b993f25ff00e9c',
        },
      ],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 0,
        'position': [
          0,
          3,
          10,
        ],
        'rotation': [
          -16,
          0,
          0,
        ],
      },
      'globalVolume': {
        'usePostProcessing': true,
        'useHDR': true,
        'useBloom': 0,
        'threshold': 1.0,
        'bloomIntensity': 1,
        'brightness': 1.5,
        'saturation': 1,
        'contrast': 1,
        'useToneMapping': 1,
      },
      'sceneBindings': [

      ],
      'timelineAsset': {
        'id': '6889598e429d48a2921f67002b46a57d',
      },
    },
  ],
  'components': [
    {
      'id': 'aac897288a7d4e3a94d2bd3cf6a4e06a',
      'dataType': 'MeshComponent',
      'item': {
        'id': 'ceaa0ba9bf204438ac74bc8840f332b8',
      },
      'materials':[{
        'id': 'd34dc6a9d6124543923042f9e304365c',
      }],
      'geometry': {
        'id': 'd6b91da1ef23413dad4bd44ae18a7407',
      },
    },
    {
      'id': '35be2cb10a014194844c6ce89c8a41c4',
      'dataType': 'LightComponent',
      'item': {
        'id': '5d2ea6f25e2b40308d824d6db9c89661',
      },
      'lightType': 'directional',
      'color': {
        'r': 1.0,
        'g': 1.0,
        'b': 1.0,
        'a': 1.0,
      },
      'intensity': 2,
      'range': 100,
    },
    {
      'id': '1de1c5af598b954a6c0dc00735efa3a9',
      'dataType': 'LightComponent',
      'item': {
        'id': 'b570cb441387e98916b993f25ff00e9c',
      },
      'lightType': 'ambient',
      'color': {
        'r': 0.2,
        'g': 0.2,
        'b': 0.2,
        'a': 1.0,
      },
      'intensity': 1,
    },
  ],
  'geometries': [
    {
      'mode': 4,
      'vertexData': {
        'vertexCount': 559,
        'channels': [
          {
            'semantic': 'POSITION',
            'offset': 0,
            'format': 1,
            'dimension': 3,
          },
          {
            'semantic': 'NORMAL',
            'offset': 6708,
            'format': 1,
            'dimension': 3,
          },
          {
            'semantic': 'TEXCOORD0',
            'offset': 13416,
            'format': 1,
            'dimension': 2,
          },
        ],
      },
      'name': '球体',
      'indexFormat': 1,
      'indexOffset': 17888,
      'buffer': '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/P9/PgAAOD/8/38+AABAPwEAQD8AADg/AABAPwAAQD8AAKA+AAA4PwAAoD7//z8/AwBQPwAAOD8AAFA/AABAP/z/vz4AADg//v+/Pv//Pz8AAGA/AAA4P///Xz8AAEA/AADgPgAAOD8AAOA+AABAPwIAcD8AADg/AQBwPwAAQD8AAAA/AAA4PwAAAD8AAEA/4P9/PQAAPD8AAAAAAAA4P/D/fz0AADw/AACAPwAAMD8AAAA/AAAwPwAAED8AADA/8P9/PQAAMD8AAAA+AAAwPwAAID8AADA/AABAPgAAMD8BADA/AAAwP/z/fz4AADA/AABAPwAAMD8AAKA+AAAwPwAAUD8AADA/AADAPgAAMD///18/AAAwPwAA4D4AADA/AQBwPwAAND8AAAAAAAA0PwAAgD8AACg/AABAPwAAKD8AAFA/AAAoPwAAoD4AACg//v+/PgAAKD///18/AAAoPwAA4D4AACg/AQBwPwAAKD8AAAA/AAAsPwAAAAAAACg/8P9/PQAALD8AAIA/AAAoPwAAED8AACg/AAAAPgAAKD8AACA/AAAoPwAAQD4AACg/AQAwPwAAKD/8/38+AAAgP/D/fz0AACA/AAAAPgAAID8AABA/AAAgPwAAID8AACA/AABAPgAAID8BADA/AAAgPwAAgD4AACA/AABAPwAAID/+/58+AAAgPwAAUD8AACA//v+/PgAAID8AAGA/AAAgPwAA4D4AACA/AQBwPwAAID8AAAA/AAAkPwAAAAAAACQ/AACAPwAAGD8AAKA+AAAYP/7/vz4AABg/AABQPwAAGD8AAGA/AAAYPwAA4D4AABg/AQBwPwAAGD8AAAA/AAAcPwAAAAAAABg/8P9/PQAAHD8AAIA/AAAYPwAAED8AABg/AAAAPgAAGD8AACA/AAAYPwAAQD4AABg/AQAwPwAAGD/8/38+AAAYPwAAQD8AABA/AAAQPwAAED8AACA/AAAQPwAAAD4AABA/AABAPgAAED8BADA/AAAQP/z/fz4AABA/AABAPwAAED8AAKA+AAAQPwAAUD8AABA//v+/PgAAED8AAGA/AAAQPwAA4D4AABA/AQBwPwAAED8AAAA/AAAUPwAAAAAAABA/8P9/PQAAFD8AAIA/AAAIPwAAUD8AAAg/AABgPwAACD/+/78+AAAIPwAA4D4AAAg/AQBwPwAACD8AAAA/AAAMPwAAAAAAAAg/8P9/PQAADD8AAIA/AAAIPwAAED8AAAg/AAAAPgAACD8AACA/AAAIPwAAQD4AAAg/AQAwPwAACD/8/38+AAAIPwAAQD8AAAg//v+fPgAAAD8AACA/////PgEAMD////8+AABAPgAAAD/8/38+AAAAPwAAQD////8+/v+fPv///z4AAFA/AAAAP/7/vz4AAAA/AABgPwAAAD8AAOA+AAAAPwEAcD////8+AAAAPwAABD8AAAAAAAAAP/D/fz0AAAQ/AACAPwAAAD8AABA/AAAAPwAAAD4AAPA+AABgPwAA8D4BAHA/AADwPgAA4D7//+8+AAAAPwAA+D4AAAAAAADwPvD/fz0AAPg+AACAPwAA8D4AABA/AADwPgAAAD4AAPA+AAAgPwAA8D4AAEA+///vPgEAMD8AAPA+/P9/PgAA8D4AAEA////vPv7/nz4AAPA+AABQPwAA8D7+/78+///fPvz/Pz4AAOA+/P9/Pv//3z4BADA/AADgPgAAQD///98+/v+fPv//3z4AAFA/AADgPv7/vz4AAOA+AABgPwAA4D4AAOA+AADgPgEAcD///98+AAAAPwAA6D4AAAAAAADgPvD/fz0AAOg+AACAPwAA4D4AABA/AADgPgAAAD4AAOA+AAAgPwAA0D4AAOA+///PPgAAAD8AANg+AAAAAAAA0D7w/389AADYPgAAgD8AANA+AQBwPwAA0D4AABA/AADQPgAAAD4AANA+AAAgPwAA0D78/z8+AADQPgEAMD8AANA+/P9/PgAA0D4AAEA/AADQPv7/nz4AANA+AABQPwAA0D7+/78+AADQPgAAYD8AAMA+AQAwPwAAwD4AAEA/AADAPvz/fz4AAMA+/v+fPv//vz4AAFA/AADAPv7/vz4AAMA+AABgPwAAwD4AAOA+AADAPgEAcD/+/78+AAAAPwAAyD4AAAAAAADAPvD/fz0AAMg+AACAPwAAwD4AABA/AADAPgAAAD4AAMA+AAAgP///vz78/z8+AAC4PgAAAAAAALA+8P9/PQAAuD4AAIA/AACwPgEAcD/+/68+AAAAPwAAsD4AABA/AACwPgAAAD4AALA+AAAgPwAAsD78/z8+AACwPgEAMD8AALA+/P9/PgAAsD4AAEA/AACwPv7/nz4AALA+AABQPwAAsD7+/78+AACwPgAAYD8AALA+AADgPgAAoD78/38+AACgPv7/nz4AAKA+AABAPwAAoD4AAFA/AACgPv7/vz4AAKA+AABgPwAAoD4AAOA+AACgPgEAcD///58+AAAAPwAAqD4AAAAAAACgPvD/fz0AAKg+AACAPwAAoD4AABA/AACgPgAAAD4AAKA+AAAgPwAAoD78/z8+AACgPgEAMD/+/48+AAAAPwAAkD4AABA/AACQPvD/fz0AAJA+AAAAPgAAkD4AACA///+PPvz/Pz4AAJA+AQAwPwAAkD78/38+AACQPgAAQD8AAJA+/v+fPv//jz4AAFA/AACQPv7/vz4AAJA+AABgPwAAkD4AAOA+AACQPgEAcD8AAJg+AAAAAAAAmD4AAIA/AACAPgAAQD/+/38+AABQP/7/fz7+/58+AACAPv7/vz7+/38+AABgP/7/fz4AAOA+AACAPgEAcD/+/38+AAAAPwAAiD4AAAAAAACAPvD/fz0AAIg+AACAP/7/fz4AABA//v9/PgAAAD4AAIA+AAAgP/7/fz78/z8+/v9/PgEAMD8AAIA+/P9/PgAAYD4AABA/AABgPgAAID8AAGA+AAAAPgAAYD78/z8+AABgPgEAMD8AAGA+/P9/PgAAYD4AAEA/AABgPv7/nz4AAGA+AABQPwAAYD7+/78+AABgPgAAYD8AAGA+AADgPgAAYD4BAHA//P9fPgAAAD8AAHA+AAAAAAAAYD7w/389AABwPgAAgD/+/z8+AABQPwAAQD4AAGA/AABAPv7/vz7+/z8+AADgPgAAQD4BAHA//v8/PgAAAD8AAFA+AAAAAAAAQD7w/389AABQPgAAgD/+/z8+AAAQPwAAQD4AAAA+AABAPgEAID/+/z8+/P8/PgAAQD4BADA/AABAPvz/fz4AAEA+AABAPwAAQD7+/58+/v8fPgAAAD7+/x8++P8/PgIAID4BACA//v8fPgEAMD/+/x8+/P9/Pv7/Hz4AAEA//v8fPv7/nz7+/x8+AQBQPwIAID7+/78+/v8fPgAAYD/+/x8+AADgPgIAID4BAHA//P8fPgAAAD8CADA+AAAAAAIAID7w/389AgAwPgAAgD/+/x8+AAAQPwAAAD7+/78+/P//PQAA4D4AAAA+AABgPwAAAD4BAHA/+P//PQAAAD8CABA+AAAAAAAAAD7w/389AgAQPgAAgD/8//89AAAQPwAAAD4AAAA+AAAAPgEAID/8//89+P8/Pvz//z0BADA/AAAAPvz/fz4AAAA+AABAP/z//z3+/58+/P//PQEAUD8AAMA9AQAgPwAAwD0BADA//P+/Pfj/Pz4AAMA9/P9/PgAAwD0BAEA/AADAPf7/nz78/789AQBQPwAAwD38/78+AADAPQAAYD/8/789AADgPgAAwD0BAHA//P+/PQAAAD8AAOA9AAAAAAAAwD3w/389AADgPQAAgD/8/789AAAQPwAAwD0AAAA+AACAPQAAYD8AAIA9AQBwPwAAgD0AAOA+8P9/PQAAAD8AAKA9AAAAAAAAgD3w/389AACgPQAAgD8AAIA9AAAQPwAAgD0AAAA+BACAPQEAID8AAIA9+P8/PgAAgD0CADA/BACAPfz/fz4EAIA9AABAPwAAgD38/58+AACAPQEAUD8EAIA9/P+/PvD//zz4/z8+AAAAPfz/fz7w//88AQAwPwAAAD0AAEA/8P//PP7/nz7w//88AQBQPwAAAD3+/78+8P//PAAAYD/w//88AADgPgAAAD0BAHA/4P//PAAAAD/4/z89AAAAAAAAAD3w/389+P8/PQAAgD/w//88AAAQP/D//zz4//89AAAAPQEAID8AAAAAAADgPgAAAAAAAAA/AACAPAAAAAAAAAAA8P9/PQAAgDwAAIA/AAAAAAEAcD8AAAAAAAAQPwAAAAD4//89AAAAAAEAID8AAAAA+P8/PgAAAAABADA/AAAAAPz/fz4AAAAAAQBAPwAAAAD+/58+AAAAAAEAUD8AAAAA/P+/PgAAAAAAAGA/AACAPwEAQD8AAIA/AQAwP///dz8CADA/AAB4PwEAQD8AAIA//v+fPgAAgD/8/38+AAB4P/z/fz7//3c//P+fPgAAgD8BAFA///93PwEAUD8AAIA//P+/PgAAeD/8/78+AACAPwAAYD///3c/AABgPwAAgD8AAOA+//93PwAA4D4AAIA/AQBwPwAAeD8BAHA/AACAPwAAAD/+/3c/AAAAPwAAgD/w/389AAB8PwAAAAAAAHg/8P9/PQAAfD8AAIA/AACAPwAAED///3c/AAAQPwAAgD/4//89//93P/j//z0AAIA/AQAgPwAAeD8BACA/AACAP/j/Pz7//3c/+P8/PgAAdD8AAIA/AABwPwEAcD/+/28/AAAAP///bz8AABA/AABwP/D/fz0AAHA/+P//PQAAcD8BACA///9vP/j/Pz7//28/AgAwPwAAcD/8/38+AABwPwEAQD///28//P+fPv//bz8BAFA/AABwP/z/vz4AAHA/AABgP///bz/+/98+AAB0PwAAAAAAAGg/AQBAP///Zz8BAFA/AABoP/z/nz4AAGg//P+/PgAAaD8AAGA///9nP/7/3z4AAGg/AQBwP///Zz8AAAA/AABsPwAAAAAAAGg/8P9/PQAAbD8AAIA///9nPwAAED8AAGg/+P//PQAAaD8BACA///9nP/j/Pz4AAGg/AgAwPwAAaD/8/38+AABgP/D/fz0AAGA/+P//Pf//Xz8AABA/AABgPwEAID/+/18/+P8/Pv//Xz8CADA/AABgP/z/fz4AAGA/AQBAP///Xz/8/58+/v9fPwEAUD8AAGA//P+/PgAAYD8AAGA///9fP/7/3z4AAGA/AQBwP/7/Xz8AAAA/AABkPwAAAAAAAGQ/AACAP///Vz/8/58+AABYP/z/vz7//1c/AwBQPwAAWD8AAGA///9XP/7/3z4AAFg/AQBwP/7/Vz8AAAA/AABcPwAAAAAAAFg/8P9/PQAAXD8AAIA///9XPwAAED8AAFg/+P//PQAAWD8BACA///9XP/T/Pz7//1c/AgAwPwAAWD/8/38+AABYPwEAQD///08/AAAQPwAAUD8BACA/AABQP/j//z3//08/9P8/Pv//Tz8CADA/AABQP/z/fz4AAFA/AQBAP///Tz/8/58+//9PPwMAUD8AAFA//P+/PgAAUD8AAGA///9PP/7/3z4AAFA/AgBwP///Tz8AAAA/AABUPwAAAAAAAFA/4P9/PQAAVD8AAIA///9HPwMAUD8AAEg/AABgPwAASD/8/78+//9HP/7/3z4AAEg/AgBwP/7/Rz8AAAA/AABMPwAAAAAAAEg/4P9/PQAATD8AAIA///9HPwAAED8AAEg/+P//PQAASD8BACA///9HP/T/Pz7//0c/AgAwPwAASD/8/38+AABIPwAAQD///0c//P+fPgAARD8AAAAAAABEPwAAgD8AAAEAAgAAAAIAAwAEAAUABgAEAAYABwAIAAAAAwAIAAMACQAKAAQABwAKAAcACwAMAAgACQAMAAkADQAOAAoACwAOAAsADwAQAAwADQAQAA0AEQASAA4ADwASAA8AEwAUABAAEQAUABEAFQAWABIAEwAWABMAFwAYABQAFQAYABUAGQAaABYAFwAaABcAGwAcAB0AHgAfABgAGQABABoAGwABABsAAgAFABwAHgAFAB4ABgACABsAIAACACAAIQAGAB4AIgAGACIAIwADAAIAIQADACEAJAAHAAYAIwAHACMAJQAJAAMAJAAJACQAJgALAAcAJQALACUAJwANAAkAJgANACYAKAAPAAsAJwAPACcAKQARAA0AKAARACgAKgATAA8AKQATACkAKwAVABEAKgAVACoALAAXABMAKwAXACsALQAZABUALAAZACwALgAbABcALQAbAC0AIAAeAC8AIgAwABkALgAqACgAMQAqADEAMgArACkAMwArADMANAAsACoAMgAsADIANQAtACsANAAtADQANgAuACwANQAuADUANwAgAC0ANgAgADYAOAAiADkAOgA7AC4ANwAhACAAOAAhADgAPAAjACIAOgAjADoAPQAkACEAPAAkADwAPgAlACMAPQAlAD0APwAmACQAPgAmAD4AQAAnACUAPwAnAD8AQQAoACYAQAAoAEAAMQApACcAQQApAEEAMwA9ADoAQgA9AEIAQwA+ADwARAA+AEQARQA/AD0AQwA/AEMARgBAAD4ARQBAAEUARwBBAD8ARgBBAEYASAAxAEAARwAxAEcASQAzAEEASAAzAEgASgAyADEASQAyAEkASwA0ADMASgA0AEoATAA1ADIASwA1AEsATQA2ADQATAA2AEwATgA3ADUATQA3AE0ATwA4ADYATgA4AE4AUAA6AFEAQgBSADcATwA8ADgAUAA8AFAARABMAEoAUwBMAFMAVABNAEsAVQBNAFUAVgBOAEwAVABOAFQAVwBPAE0AVgBPAFYAWABQAE4AVwBQAFcAWQBCAFoAWwBcAE8AWABEAFAAWQBEAFkAXQBDAEIAWwBDAFsAXgBFAEQAXQBFAF0AXwBGAEMAXgBGAF4AYABHAEUAXwBHAF8AYQBIAEYAYABIAGAAYgBJAEcAYQBJAGEAYwBKAEgAYgBKAGIAUwBLAEkAYwBLAGMAVQBfAF0AZABfAGQAZQBgAF4AZgBgAGYAZwBhAF8AZQBhAGUAaABiAGAAZwBiAGcAaQBjAGEAaABjAGgAagBTAGIAaQBTAGkAawBVAGMAagBVAGoAbABUAFMAawBUAGsAbQBWAFUAbABWAGwAbgBXAFQAbQBXAG0AbwBYAFYAbgBYAG4AcABZAFcAbwBZAG8AcQBbAHIAcwB0AFgAcABdAFkAcQBdAHEAZABeAFsAcwBeAHMAZgBuAGwAdQBuAHUAdgBvAG0AdwBvAHcAeABwAG4AdgBwAHYAeQBxAG8AeABxAHgAegBzAHsAfAB9AHAAeQBkAHEAegBkAHoAfgBmAHMAfABmAHwAfwBlAGQAfgBlAH4AgABnAGYAfwBnAH8AgQBoAGUAgABoAIAAggBpAGcAgQBpAIEAgwBqAGgAggBqAIIAhABrAGkAgwBrAIMAhQBsAGoAhABsAIQAdQBtAGsAhQBtAIUAdwCCAIAAhgCCAIYAhwCDAIEAiACDAIgAiQCEAIIAhwCEAIcAigCFAIMAiQCFAIkAiwB1AIQAigB1AIoAjAB3AIUAiwB3AIsAjQB2AHUAjAB2AIwAjgB4AHcAjQB4AI0AjwB5AHYAjgB5AI4AkAB6AHgAjwB6AI8AkQB8AJIAkwCUAHkAkAB+AHoAkQB+AJEAlQB/AHwAkwB/AJMAlgCAAH4AlQCAAJUAhgCBAH8AlgCBAJYAiACQAI4AlwCQAJcAmACRAI8AmQCRAJkAmgCTAJsAnACdAJAAmACVAJEAmgCVAJoAngCWAJMAnACWAJwAnwCGAJUAngCGAJ4AoACIAJYAnwCIAJ8AoQCHAIYAoACHAKAAogCJAIgAoQCJAKEAowCKAIcAogCKAKIApACLAIkAowCLAKMApQCMAIoApACMAKQApgCNAIsApQCNAKUApwCOAIwApgCOAKYAlwCPAI0ApwCPAKcAmQCjAKEAqACjAKgAqQCkAKIAqgCkAKoAqwClAKMAqQClAKkArACmAKQAqwCmAKsArQCnAKUArACnAKwArgCXAKYArQCXAK0ArwCZAKcArgCZAK4AsACYAJcArwCYAK8AsQCaAJkAsACaALAAsgCcALMAtAC1AJgAsQCeAJoAsgCeALIAtgCfAJwAtACfALQAtwCgAJ4AtgCgALYAuAChAJ8AtwChALcAqACiAKAAuACiALgAqgCyALAAuQCyALkAugC0ALsAvAC9ALEAvgC2ALIAugC2ALoAvwC3ALQAvAC3ALwAwAC4ALYAvwC4AL8AwQCoALcAwACoAMAAwgCqALgAwQCqAMEAwwCpAKgAwgCpAMIAxACrAKoAwwCrAMMAxQCsAKkAxACsAMQAxgCtAKsAxQCtAMUAxwCuAKwAxgCuAMYAyACvAK0AxwCvAMcAyQCwAK4AyACwAMgAuQCxAK8AyQCxAMkAvgDFAMMAygDFAMoAywDGAMQAzADGAMwAzQDHAMUAywDHAMsAzgDIAMYAzQDIAM0AzwDJAMcAzgDJAM4A0AC5AMgAzwC5AM8A0QC+AMkA0AC+ANAA0gC6ALkA0QC6ANEA0wC8ANQA1QDWAL4A0gC/ALoA0wC/ANMA1wDAALwA1QDAANUA2ADBAL8A1wDBANcA2QDCAMAA2ADCANgA2gDDAMEA2QDDANkAygDEAMIA2gDEANoAzADVANsA3ADdANIA3gDXANMA3wDXAN8A4ADYANUA3ADYANwA4QDZANcA4ADZAOAA4gDaANgA4QDaAOEA4wDKANkA4gDKAOIA5ADMANoA4wDMAOMA5QDLAMoA5ADLAOQA5gDNAMwA5QDNAOUA5wDOAMsA5gDOAOYA6ADPAM0A5wDPAOcA6QDQAM4A6ADQAOgA6gDRAM8A6QDRAOkA6wDSANAA6gDSAOoA3gDTANEA6wDTAOsA3wDnAOUA7ADnAOwA7QDoAOYA7gDoAO4A7wDpAOcA7QDpAO0A8ADqAOgA7wDqAO8A8QDrAOkA8ADrAPAA8gDeAOoA8QDeAPEA8wDfAOsA8gDfAPIA9ADcAPUA9gD3AN4A8wDgAN8A9ADgAPQA+ADhANwA9gDhAPYA+QDiAOAA+ADiAPgA+gDjAOEA+QDjAPkA+wDkAOIA+gDkAPoA/ADlAOMA+wDlAPsA7ADmAOQA/ADmAPwA7gD4APQA/QD4AP0A/gD5APYA/wD5AP8AAAH6APgA/gD6AP4AAQH7APkAAAH7AAABAgH8APoAAQH8AAEBAwHsAPsAAgHsAAIBBAHuAPwAAwHuAAMBBQHtAOwABAHtAAQBBgHvAO4ABQHvAAUBBwHwAO0ABgHwAAYBCAHxAO8ABwHxAAcBCQHyAPAACAHyAAgBCgHzAPEACQHzAAkBCwH0APIACgH0AAoB/QD2AAwB/wANAfMACwEHAQUBDgEHAQ4BDwEIAQYBEAEIARABEQEJAQcBDwEJAQ8BEgEKAQgBEQEKAREBEwELAQkBEgELARIBFAH9AAoBEwH9ABMBFQH/ABYBFwEYAQsBFAH+AP0AFQH+ABUBGQEAAf8AFwEAARcBGgEBAf4AGQEBARkBGwECAQABGgECARoBHAEDAQEBGwEDARsBHQEEAQIBHAEEARwBHgEFAQMBHQEFAR0BDgEGAQQBHgEGAR4BEAEbARkBHwEbAR8BIAEcARoBIQEcASEBIgEdARsBIAEdASABIwEeARwBIgEeASIBJAEOAR0BIwEOASMBJQEQAR4BJAEQASQBJgEPAQ4BJQEPASUBJwERARABJgERASYBKAESAQ8BJwESAScBKQETAREBKAETASgBKgEUARIBKQEUASkBKwEVARMBKgEVASoBLAEXAS0BLgEvARQBKwEZARUBLAEZASwBHwEaARcBLgEaAS4BIQEpAScBMAEpATABMQEqASgBMgEqATIBMwErASkBMQErATEBNAEsASoBMwEsATMBNQEuATYBNwE4ASsBNAEfASwBNQEfATUBOQEhAS4BNwEhATcBOgEgAR8BOQEgATkBOwEiASEBOgEiAToBPAEjASABOwEjATsBPQEkASIBPAEkATwBPgElASMBPQElAT0BPwEmASQBPgEmAT4BQAEnASUBPwEnAT8BMAEoASYBQAEoAUABMgE8AToBQQE8AUEBQgE9ATsBQwE9AUMBRAE+ATwBQgE+AUIBRQE/AT0BRAE/AUQBRgFAAT4BRQFAAUUBRwEwAT8BRgEwAUYBSAEyAUABRwEyAUcBSQExATABSAExAUgBSgEzATIBSQEzAUkBSwE0ATEBSgE0AUoBTAE1ATMBSwE1AUsBTQE3AU4BTwFQATQBTAE5ATUBTQE5AU0BUQE6ATcBTwE6AU8BQQE7ATkBUQE7AVEBQwFLAUkBUgFLAVIBUwFMAUoBVAFMAVQBVQFNAUsBUwFNAVMBVgFPAVcBWAFZAUwBVQFRAU0BVgFRAVYBWgFBAU8BWAFBAVgBWwFDAVEBWgFDAVoBXAFCAUEBWwFCAVsBXQFEAUMBXAFEAVwBXgFFAUIBXQFFAV0BXwFGAUQBXgFGAV4BYAFHAUUBXwFHAV8BYQFIAUYBYAFIAWABYgFJAUcBYQFJAWEBUgFKAUgBYgFKAWIBVAFeAVwBYwFeAWMBZAFfAV0BZQFfAWUBZgFgAV4BZAFgAWQBZwFhAV8BZgFhAWYBaAFiAWABZwFiAWcBaQFSAWEBaAFSAWgBagFUAWIBaQFUAWkBawFTAVIBagFTAWoBbAFVAVQBawFVAWsBbQFWAVMBbAFWAWwBbgFYAW8BcAFxAVUBbQFaAVYBbgFaAW4BcgFbAVgBcAFbAXABcwFcAVoBcgFcAXIBYwFdAVsBcwFdAXMBZQFtAWsBdAFtAXQBdQFuAWwBdgFuAXYBdwFwAXgBeQF6AW0BdQFyAW4BdwFyAXcBewFzAXABeQFzAXkBfAFjAXIBewFjAXsBfQFlAXMBfAFlAXwBfgFkAWMBfQFkAX0BfwFmAWUBfgFmAX4BgAFnAWQBfwFnAX8BgQFoAWYBgAFoAYABggFpAWcBgQFpAYEBgwFqAWgBggFqAYIBhAFrAWkBgwFrAYMBdAFsAWoBhAFsAYQBdgGAAX4BhQGAAYUBhgGBAX8BhwGBAYcBiAGCAYABhgGCAYYBiQGDAYEBiAGDAYgBigGEAYIBiQGEAYkBiwF0AYMBigF0AYoBjAF2AYQBiwF2AYsBjQF1AXQBjAF1AYwBjgF3AXYBjQF3AY0BjwF5AZABkQGSAXUBjgF7AXcBjwF7AY8BkwF8AXkBkQF8AZEBlAF9AXsBkwF9AZMBlQF+AXwBlAF+AZQBhQF/AX0BlQF/AZUBhwGPAY0BlgGPAZYBlwGRAZgBmQGaAY4BmwGTAY8BlwGTAZcBnAGUAZEBmQGUAZkBnQGVAZMBnAGVAZwBngGFAZQBnQGFAZ0BnwGHAZUBngGHAZ4BoAGGAYUBnwGGAZ8BoQGIAYcBoAGIAaABogGJAYYBoQGJAaEBowGKAYgBogGKAaIBpAGLAYkBowGLAaMBpQGMAYoBpAGMAaQBpgGNAYsBpQGNAaUBlgGOAYwBpgGOAaYBmwGnAagBqQGnAakBqgGrAawBrQGrAa0BrgGvAacBqgGvAaoBsAGxAasBrgGxAa4BsgGzAa8BsAGzAbABtAG1AbEBsgG1AbIBtgG3AbMBtAG3AbQBuAG5AbUBtgG5AbYBugG7AbwBvQG+AbcBuAG/AbkBugG/AboBwAHBAbsBvQHBAb0BwgHDAb8BwAHDAcABxAHFAcEBwgHFAcIBxgGoAcMBxAGoAcQBqQGsAcUBxgGsAcYBrQHHAbgByAHAAboByQHAAckBygHCAb0BywHCAcsBzAHEAcABygHEAcoBzQHGAcIBzAHGAcwBzgGpAcQBzQGpAc0BzwGtAcYBzgGtAc4B0AGqAakBzwGqAc8B0QGuAa0B0AGuAdAB0gGwAaoB0QGwAdEB0wGyAa4B0gGyAdIB1AG0AbAB0wG0AdMB1QG2AbIB1AG2AdQB1gG4AbQB1QG4AdUByAG6AbYB1gG6AdYByQG9AdcBywHTAdEB2AHTAdgB2QHUAdIB2gHUAdoB2wHVAdMB2QHVAdkB3AHWAdQB2wHWAdsB3QHIAdUB3AHIAdwB3gHJAdYB3QHJAd0B3wHLAeAB4QHiAcgB3gHKAckB3wHKAd8B4wHMAcsB4QHMAeEB5AHNAcoB4wHNAeMB5QHOAcwB5AHOAeQB5gHPAc0B5QHPAeUB5wHQAc4B5gHQAeYB6AHRAc8B5wHRAecB2AHSAdAB6AHSAegB2gHkAeEB6QHkAekB6gHlAeMB6wHlAesB7AHmAeQB6gHmAeoB7QHnAeUB7AHnAewB7gHoAeYB7QHoAe0B7wHYAecB7gHYAe4B8AHaAegB7wHaAe8B8QHZAdgB8AHZAfAB8gHbAdoB8QHbAfEB8wHcAdkB8gHcAfIB9AHdAdsB8wHdAfMB9QHeAdwB9AHeAfQB9gHfAd0B9QHfAfUB9wHhAfgB6QH5Ad4B9gHjAd8B9wHjAfcB6wHzAfEB+gHzAfoB+wH0AfIB/AH0AfwB/QH1AfMB+wH1AfsB/gH2AfQB/QH2Af0B/wH3AfUB/gH3Af4BAALpAQECAgIDAvYB/wHrAfcBAALrAQACBALqAekBAgLqAQICBQLsAesBBALsAQQCBgLtAeoBBQLtAQUCBwLuAewBBgLuAQYCCALvAe0BBwLvAQcCCQLwAe4BCALwAQgCCgLxAe8BCQLxAQkC+gHyAfABCgLyAQoC/AEGAgQCCwIGAgsCDAIHAgUCDQIHAg0CDgIIAgYCDAIIAgwCDwIJAgcCDgIJAg4CEAIKAggCDwIKAg8CEQL6AQkCEAL6ARACEgL8AQoCEQL8ARECEwL7AfoBEgL7ARICFAL9AfwBEwL9ARMCFQL+AfsBFAL+ARQCFgL/Af0BFQL/ARUCFwIAAv4BFgIAAhYCGAICAhkCGgIbAv8BFwIEAgACGAIEAhgCCwIFAgICGgIFAhoCDQIVAhMCHAIVAhwCHQIWAhQCHgIWAh4CHwIXAhUCHQIXAh0CIAIYAhYCHwIYAh8CIQIaAiICIwIkAhcCIAILAhgCIQILAiECJQINAhoCIwINAiMCJgIMAgsCJQIMAiUCJwIOAg0CJgIOAiYCKAIPAgwCJwIPAicCKQIQAg4CKAIQAigCKgIRAg8CKQIRAikCKwISAhACKgISAioCLAITAhECKwITAisCHAIUAhICLAIUAiwCHgIoAiYCBQAoAgUABAApAicCAAApAgAACAAqAigCBAAqAgQACgArAikCCAArAggADAAsAioCCgAsAgoADgAcAisCDAAcAgwAEAAeAiwCDgAeAg4AEgAdAhwCEAAdAhAAFAAfAh4CEgAfAhIAFgAgAh0CFAAgAhQAGAAhAh8CFgAhAhYAGgAjAi0CHAAuAiACGAAlAiECGgAlAhoAAQAmAiMCHAAmAhwABQAnAiUCAQAnAgEAAAA=',
      'id': 'd6b91da1ef23413dad4bd44ae18a7407',
      'dataType': 'Geometry',
      'subMeshes': [
        {
          'indexCount': 2880,
          'offset': 0,
          'vertexCount': 559,
        },
      ],
    },
  ],
  'materials': [
    {
      'id': 'd34dc6a9d6124543923042f9e304365c',
      'shader': {
        'id': 'pbr00000000000000000000000000000',
      },
      'name': '3d-material',
      'dataType': 'Material',
      'zTest': true,
      'zWrite': true,
      'blending': false,
      'stringTags': {
        'RenderType': 'Opaque',
        'RenderFace': 'Both',
      },
      'ints': {
      },
      'floats': {
        '_SpecularAA': 1,
        '_AlphaCutoff': 0.3,
        '_MetallicFactor': 0.0,
        '_RoughnessFactor': 0.2,
        '_NormalScale': 1,
        '_OcclusionStrength': 1,
        '_EmissiveIntensity': 0,
      },
      'vector4s': {
      },
      'colors': {
        '_BaseColorFactor': {
          'r': 1,
          'g': 1,
          'b': 1,
          'a': 1,
        },
        '_EmissiveFactor': {
          'r': 0.6,
          'g': 0.2,
          'b': 0.8,
          'a': 1,
        },
      },
      'textures': {
        '_BaseColorSampler': {
          'texture': {
            'id': 'whitetexture00000000000000000000',
          },
        },
      },
    },
  ],
  'items': [
    {
      'id': 'ceaa0ba9bf204438ac74bc8840f332b8',
      'name': '3d-mesh',
      'duration': 1000,
      'dataType': 'VFXItemData',
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'rotation': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'components': [
        {
          'id': 'aac897288a7d4e3a94d2bd3cf6a4e06a',
        },
      ],
      'listIndex': 6,
      'content': {},
    },
    {
      'id': '5d2ea6f25e2b40308d824d6db9c89661',
      'name': '3d-light',
      'duration': 1000,
      'dataType': 'VFXItemData',
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'rotation': {
          'x': 45,
          'y': -30,
          'z': 0,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'components': [
        {
          'id': '35be2cb10a014194844c6ce89c8a41c4',
        },
      ],
      'listIndex': 6,
      'content': {},
    },
    {
      'id': 'b570cb441387e98916b993f25ff00e9c',
      'name': '3d-ambient-light',
      'duration': 1000,
      'dataType': 'VFXItemData',
      'type': '1',
      'visible': true,
      'endBehavior': 2,
      'delay': 0,
      'renderLevel': 'B+',
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'rotation': {
          'x': 45,
          'y': -30,
          'z': 0,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'components': [
        {
          'id': '1de1c5af598b954a6c0dc00735efa3a9',
        },
      ],
      'listIndex': 6,
      'content': {},
    },
  ],
  'shaders': [
    {
      'id': '90ed7bbc1c364b3097b502b4a0f13d5b',
      'name': 'unlit',
      'dataType': 'Shader',
      'vertex': 'precision highp float;attribute vec3 aPos;attribute vec2 aUV;varying vec2 uv;uniform mat4 effects_ObjectToWorld;uniform mat4 effects_MatrixInvV;uniform mat4 effects_MatrixVP;void main(){uv=aUV;gl_Position=effects_MatrixVP*effects_ObjectToWorld*vec4(aPos,1.0);}',
      'fragment': 'precision highp float;varying vec2 uv;uniform vec4 _MainColor;uniform sampler2D _MainTex;uniform sampler2D _Tex2;uniform sampler2D _Tex3;void main(){vec4 texColor=texture2D(_MainTex,uv).rgba;vec4 color=texColor*_MainColor.rgba;gl_FragColor=vec4(color);}',
      'properties': '_MainTex("MainTex", 2D) = "white" {}\n_MainColor("MainColor", Color) = (1,1,1,1)',
    },
  ],
  'bins': [],
  'textures': [],
  'animations': [],
  'miscs': [
    {
      'id': '6889598e429d48a2921f67002b46a57d',
      'dataType': 'TimelineAsset',
      'tracks': [
      ],
    },
  ],
  'compositionId': '1',
  'spines': [],
};