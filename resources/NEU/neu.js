// 文件: school.js

// 1. 显示一个公告信息弹窗
async function demoAlert() {
    try {
        console.log("即将显示公告弹窗...");
        const confirmed = await window.AndroidBridgePromise.showAlert(
            "注意",
            "教务系统网址仅在校园网/连接校内vpn环境下可访问，无法进入时请检查网络连接，本适配仅适配东北大学本科生新教务系统，其他院校或研究生用户请谨慎使用。如有问题请联系开发者反馈。",
            "我知道了"
        );
        if (confirmed) {
            return true; // 成功时返回 true
        } else {
            return false; // 用户取消时返回 false
        }
    } catch (error) {
        console.error("显示公告弹窗时发生错误:", error);
        AndroidBridge.showToast("Alert：显示弹窗出错！" + error.message);
        return false; // 出现错误时也返回 false
    }
}

// 1.1 显示校区选择弹窗
async function showCampusSelection() {
    try {
        console.log("即将显示校区选择弹窗...");
        const selectedCampus = await window.AndroidBridgePromise.showSingleChoiceDialog(
            "请选择校区",
            ["南湖校区", "浑南校区"],
            "浑南校区" // 默认选中浑南校区
        );
        
        if (selectedCampus) {
            console.log(`用户选择了: ${selectedCampus}`);
            AndroidBridge.showToast(`已选择: ${selectedCampus}`);
            return selectedCampus;
        } else {
            console.log("用户取消了校区选择");
            return null; // 用户取消
        }
    } catch (error) {
        console.error("显示校区选择弹窗时发生错误:", error);
        AndroidBridge.showToast("校区选择出错: " + error.message);
        return null; // 出现错误时也返回 null
    }
}

// 2. 从课表页面中提取课程数据
async function extractCoursesFromPage() {
    const iframe = document.querySelector('iframe');
    const lessons = [];
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const time = iframeDoc.querySelector('.kbappTimeXQText')
    const time_text = time.textContent; 
    const dayCols = iframeDoc.querySelectorAll('.kbappTimetableDayColumnRoot');
    
    dayCols.forEach((dayCol, dayIndex) => {
        const timeSlots = dayCol.children;
        const day = dayIndex >= 1 ? dayIndex : 7;
        
        let startSection = 0;
        let endSection = 0;
        
        for (let slot of timeSlots) {
            const flexValue = slot.style.flex;
            const nums = parseInt(flexValue.split(' ')[0]);
            startSection = endSection + 1;
            endSection = startSection + nums - 1;
            
            if (slot.classList.contains('kbappTimetableDayColumnConflictContainer')) {
                // 获取所有课程项
                const courseItems = slot.querySelectorAll('.kbappTimetableCourseRenderCourseItem');
                
                courseItems.forEach(courseItem => {
                    const infoTexts = courseItem.querySelectorAll('.kbappTimetableCourseRenderCourseItemInfoText');
                    let name, details;
                    
                    infoTexts.forEach((text, idx) => {
                        if (idx === 0) name = text.textContent.trim();
                        else if (idx === 1) details = parseCourseDetails(text.textContent.trim());
                        else if (idx === 2) return;
                    });
                    
                    lessons.push({
                        name: name, 
                        teacher: details.teacher, 
                        position: details.position, 
                        day: day, 
                        startSection: startSection, 
                        endSection: endSection,
                        weeks: details.weeks
                    });
                });
            } 
        }
        console.log("信息提取中");
    });

    return { lessons: lessons, time_text: time_text };
}

// 2.1 解析课程详情字符串，提取周次、教师和地点信息
function parseCourseDetails(detailStr) {
    // 匹配所有周次模式
    const weekPattern = /(\d+-\d+周(?:\([单双]\))?|\d+周(?:\([单双]\))?)/g;
    const weekMatches = detailStr.match(weekPattern);
    
    let weeks = '';
    let remaining = detailStr;
    
    if (weekMatches) {
        // 提取所有周次部分
        weeks = weekMatches.join(',');
        // 从原字符串中移除周次部分
        weekMatches.forEach(match => {
            remaining = remaining.replace(match, '');
        });
    }
    
    // 按空格分割剩余部分
    const parts = remaining.trim().split(/\s+/).filter(p => p);
    
    let teacher = '';
    let position = '';
    if (parts.length > 0) {
        teacher = parts[0];
        if (parts.length > 1) {
            position = parts.slice(1).join(' '); // 修正这一行
        }
    }
    
    // 清理教师名中的多余逗号
    teacher = teacher.replace(/^[,，]/, '').replace(/[,，]$/, '');
    
    return {
        weeks: parseWeeksString(weeks),
        teacher: teacher.trim(),
        position: position.trim()
    };
}

// 2.2将周次文字提取成数组
function parseWeeksString(weeksStr) {
    if (!weeksStr) return [];
    
    const result = [];
    const weekParts = weeksStr.split(/[，,]/).map(part => part.trim());
    
    weekParts.forEach(part => {
        // 匹配单个数字周
        const singleMatch = part.match(/^(\d+)周(?:\(([单双])\))?$/);
        if (singleMatch) {
            const num = parseInt(singleMatch[1]);
            const type = singleMatch[2];
            if (!type || (type === '单' && num % 2 === 1) || (type === '双' && num % 2 === 0)) {
                result.push(num);
            }
            return;
        }
        
        // 匹配范围周
        const rangeMatch = part.match(/^(\d+)-(\d+)周(?:\(([单双])\))?$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            const type = rangeMatch[3];
            
            if (!type) {
                for (let i = start; i <= end; i++) result.push(i);
            } else if (type === '单') {
                for (let i = start; i <= end; i++) {
                    if (i % 2 === 1) result.push(i);
                }
            } else if (type === '双') {
                for (let i = start; i <= end; i++) {
                    if (i % 2 === 0) result.push(i);
                }
            }
        }
    });
    
    return [...new Set(result)].sort((a, b) => a - b);
}

// 2.3 解析学期字符串，返回对应的开学日期
function parseSemesterToDate(semesterStr) {
    // 使用正则表达式提取年份和学期信息
    const regex = /(\d{4})-(\d{4})学年(春季|秋季)学期/;
    const match = semesterStr.match(regex);
    
    if (!match) {
        throw new Error('学期字符串格式不正确，应为："XXXX-XXXX学年春季/秋季学期"');
    }
    
    const startYear = parseInt(match[1]);  // 前一个年份
    const endYear = parseInt(match[2]);    // 后一个年份
    const season = match[3];               // 春季或秋季
    
    // 验证年份格式是否正确（后一年份应比前一年份大1）
    if (endYear !== startYear + 1) {
        throw new Error('年份格式不正确，后一年份应比前一年份大1');
    }
    
    let resultDate;
    
    if (season === '春季') {
        // 春季学期：使用后一个年份的3月1日
        resultDate = `${endYear}-03-01`;
    } else if (season === '秋季') {
        // 秋季学期：使用前一个年份的9月1日
        resultDate = `${startYear}-09-01`;
    } else {
        throw new Error('学期类型不正确，应为"春季"或"秋季"');
    }
    
    return resultDate;
}

// 3. 导入课程数据
async function SaveCourses(lessons) {
    console.log("正在准备导入课程数据...");
    const testCourses = lessons;

    try {
        console.log("正在尝试导入课程...");
        const result = await window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(testCourses));
        if (result === true) {
            console.log("课程导入成功！");
        } else {
            console.log("课程导入未成功，结果：" + result);
            AndroidBridge.showToast("课程导入失败，请查看日志。");
        }
    } catch (error) {
        console.error("导入课程时发生错误:", error);
        AndroidBridge.showToast("导入课程失败: " + error.message);
    }
}

// 4. 根据校区导入对应的时间段
async function importTimeSlotsByCampus(campus) {
    console.log(`正在准备${campus}时间段数据...`);
    
    // 浑南校区时间表（现有时间表）
    const hunNanTimeSlots = [
        { "number": 1, "startTime": "08:30", "endTime": "09:15" },
        { "number": 2, "startTime": "09:25", "endTime": "10:10" },
        { "number": 3, "startTime": "10:30", "endTime": "11:15" },
        { "number": 4, "startTime": "11:25", "endTime": "12:10" },
        { "number": 5, "startTime": "14:00", "endTime": "14:45" },
        { "number": 6, "startTime": "14:55", "endTime": "15:40" },
        { "number": 7, "startTime": "16:00", "endTime": "16:45" },
        { "number": 8, "startTime": "16:55", "endTime": "17:40" },
        { "number": 9, "startTime": "18:30", "endTime": "19:15" },
        { "number": 10, "startTime": "19:25", "endTime": "20:10" },
        { "number": 11, "startTime": "20:30", "endTime": "21:15" },
        { "number": 12, "startTime": "21:15", "endTime": "22:10" },
    ];
    
    // 南湖校区时间表（根据图片内容）
    const nanHuTimeSlots = [
        { "number": 1, "startTime": "08:00", "endTime": "08:45" },
        { "number": 2, "startTime": "08:55", "endTime": "09:40" },
        { "number": 3, "startTime": "10:00", "endTime": "10:45" },
        { "number": 4, "startTime": "10:55", "endTime": "11:40" },
        { "number": 5, "startTime": "14:00", "endTime": "14:45" },
        { "number": 6, "startTime": "14:55", "endTime": "15:40" },
        { "number": 7, "startTime": "16:00", "endTime": "16:45" },
        { "number": 8, "startTime": "16:55", "endTime": "17:40" },
        { "number": 9, "startTime": "18:30", "endTime": "19:15" },
        { "number": 10, "startTime": "19:25", "endTime": "20:10" },
        { "number": 11, "startTime": "20:20", "endTime": "21:05" },
        { "number": 12, "startTime": "21:15", "endTime": "22:00" },
    ];
    
    // 根据校区选择对应的时间表
    const timeSlotsToImport = (campus === "南湖校区") ? nanHuTimeSlots : hunNanTimeSlots;

    try {
        console.log(`正在尝试导入${campus}时间段...`);
        const result = await window.AndroidBridgePromise.savePresetTimeSlots(JSON.stringify(timeSlotsToImport));
        if (result === true) {
            console.log(`${campus}时间段导入成功！`);
            AndroidBridge.showToast(`${campus}时间段已应用`);
        } else {
            console.log("时间段导入未成功，结果：" + result);
            window.AndroidBridge.showToast("时间段导入失败，请查看日志。");
        }
    } catch (error) {
        console.error("导入时间段时发生错误:", error);
        window.AndroidBridge.showToast("导入时间段失败: " + error.message);
    }
}

// 5. 导入课表配置
async function SaveConfig(time_text) {
    console.log("正在准备配置数据...");
    startDate = parseSemesterToDate(time_text);
    // 注意：只传入要修改的字段，其他字段（如 semesterTotalWeeks）会使用 Kotlin 模型中的默认值
    const courseConfigData = {
        "semesterStartDate": startDate,
        "semesterTotalWeeks": 18,
        "defaultClassDuration": 45,
        "defaultBreakDuration": 10,
        "firstDayOfWeek": 7
    };

    try {
        console.log("正在尝试导入课表配置...");
        const configJsonString = JSON.stringify(courseConfigData);

        const result = await window.AndroidBridgePromise.saveCourseConfig(configJsonString);

        if (result === true) {
            console.log("课表配置导入成功！");
        } else {
            console.log("课表配置导入未成功，结果：" + result);
            AndroidBridge.showToast("配置导入失败，请查看日志。");
        }
    } catch (error) {
        console.error("导入配置时发生错误:", error);
        AndroidBridge.showToast("导入配置失败: " + error.message);
    }
}

/**
 * 编排这些异步操作，并在用户取消时停止后续执行。
 */
async function runAllDemosSequentially() {
    AndroidBridge.showToast("开始导入课表...");
    
    // // 1. 提示公告
    // const alertResult = await demoAlert();
    // if (!alertResult) {
    //     console.log("用户取消了公告提示，停止后续执行。");
    //     return; // 用户取消，立即退出函数
    // }

    // 2. 校区选择
    const selectedCampus = await showCampusSelection();
    if (!selectedCampus) {
        console.log("用户取消了校区选择，停止后续执行。");
        AndroidBridge.showToast("已取消导入");
        return; // 用户取消，立即退出函数
    }

    console.log(`开始为${selectedCampus}导入课表数据...`);
    AndroidBridge.showToast(`正在导入${selectedCampus}课表...`);

    // 3. 从课表页面中提取课程数据
    const PageInfo = await extractCoursesFromPage();
    const lessons = PageInfo.lessons;
    const time_text = PageInfo.time_text;
    
    // 4. 保存课程数据到数据库
    await SaveCourses(lessons);
    
    // 5. 根据选择的校区导入对应的时间段
    await importTimeSlotsByCampus(selectedCampus);
    
    // 6. 保存底层配置
    await SaveConfig(time_text);

    // 发送最终的生命周期完成信号
    AndroidBridge.notifyTaskCompletion();
    AndroidBridge.showToast("课表导入完成！");
}

// 启动所有演示
runAllDemosSequentially();