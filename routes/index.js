/**
 * @Date         : 2022-03-29 14:18:15
 * @Description  : 
 * @Autor        : Qzr(z5021996@vip.qq.com)
 * @LastEditors  : Qzr(z5021996@vip.qq.com)
 * @LastEditTime : 2022-04-01 16:29:58
 */

const router = require('koa-router')()
const koaBody = require("koa-body")
const path = require('path')
const fs = require('fs')

const outputPath = path.resolve(__dirname, '../static')

router.get('/', async (ctx, next) => {
  await ctx.render('index', {
    title: 'Hello Koa 2!'
  })
})

router.get('/api/string', async (ctx, next) => {
  ctx.body = 'koa2 string'
})

router.get('/json', async (ctx, next) => {
  ctx.body = {
    title: 'koa2 json'
  }
})

// 上传请求
router.post(
  '/api/upload',
  // 处理文件 form-data 数据
  koaBody({
    multipart: true,
    formidable: {
      uploadDir: outputPath,
      onFileBegin: (name, file) => {
        const [filename, fileHash, index] = name.split('^');
        const dir = path.join(outputPath, filename + '-cache');
        // console.log('thissssssss', filename, fileHash, index, dir, name, file)
        // 保存当前 chunk 信息，发生错误时进行返回
        currChunk = {
          filename,
          fileHash,
          index
        };

        // 检查文件夹是否存在如果不存在则新建文件夹
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }

        // 覆盖文件存放的完整路径
        file.path = `${dir}/${fileHash}-${index}`;
      },
      onError: (error) => {
        app.status = 400;
        app.body = { code: 400, msg: "上传失败", data: currChunk };
        return;
      },
    },
  }),
  // 处理响应
  async (ctx) => {
    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify({
      code: 2000,
      message: 'upload successfully！'
    });
  });

  // 合并请求
router.post('/api/mergeChunks', async (ctx) => {
  const { filename, chunkSize } = ctx.request.body;
  console.log(filename, chunkSize)
  // 合并 chunks
  await mergeFileChunk(path.join(outputPath, filename), filename, chunkSize);

  // 处理响应
  ctx.set("Content-Type", "application/json");
  ctx.body = JSON.stringify({
    data: {
      code: 2000,
      filename,
      chunkSize
    },
    message: 'merge chunks successful！'
  });
});

// 通过管道处理流 
const pipeStream = (path, writeStream) => {
  return new Promise(resolve => {
    const readStream = fs.createReadStream(path, {
      autoClose: true
    });
    readStream.on("end", () => {
      fs.unlinkSync(path);
      readStream.close()
      resolve();
    });
    readStream.pipe(writeStream);
  });
}

// 合并切片
const mergeFileChunk = async (filePath, filename, chunkSize) => {
  const chunkDir = path.join(outputPath, filename + '-cache');
  const chunkPaths = fs.readdirSync(chunkDir);
  let write

  if (!chunkPaths.length) return;

  // 根据切片下标进行排序，否则直接读取目录的获得的顺序可能会错乱
  // chunkPaths.sort((a, b) => a - b)
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
  console.log("chunkPaths = ", chunkPaths, chunkDir, filePath, chunkSize);

  try {
    await Promise.all(
      chunkPaths.map((chunkPath, index) => {
        return pipeStream(
            path.resolve(chunkDir, chunkPath),
            // 指定位置创建可写流
            write = fs.createWriteStream(filePath, {
              start: index * chunkSize,
              // end: (index + 1) * chunkSize,
              autoClose: true
            })
          )
      }
      )
    );
    
  } catch (error) {
    console.log('errorerrorerrorerror', error)
    return
  }
  
  // 合并后删除保存切片的目录
  write.close()
  fs.rmdirSync(chunkDir);
};


module.exports = router
