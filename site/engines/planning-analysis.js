/* Berekening los van de canvasweergave. Een taak draagt alleen bij aan de
   werkelijk geraakte meetmomenten. De bestaande toleranties en optelvolgorde
   blijven gelijk, inclusief de aparte VWM-formatie uit het fasemodel. */
var PlanningAnalysis=(function(){
  function lowerBound(buckets,time){
    var lo=0,hi=buckets.length;
    while(lo<hi){var mid=(lo+hi)>>>1;if(buckets[mid].t<time)lo=mid+1;else hi=mid;}
    return lo;
  }
  function range(buckets,start,finish){
    if(Number.isNaN(start)||Number.isNaN(finish)||finish<=start)return [0,0];
    return [lowerBound(buckets,start),lowerBound(buckets,finish)];
  }
  function weekly(input){
    var buckets=[],roles=input.roles||[],roleBuckets={};
    for(var t=input.t0;t<=input.t1+0.001;t+=1/52.1775){
      var bucket={t:t};input.services.forEach(function(d){bucket[d]=0;});buckets.push(bucket);
    }
    roles.forEach(function(role){roleBuckets[role]=new Array(buckets.length).fill(0);});
    input.tasks.forEach(function(task){
      if(!task.allocations.length)return;
      var span=range(buckets,task.start-0.001,task.finish-0.001);
      for(var i=span[0];i<span[1];i++){
        task.allocations.forEach(function(a){if(a.fte>0)buckets[i][a.service]=(buckets[i][a.service]||0)+a.fte;});
      }
    });
    input.vwm.forEach(function(task){
      var span=range(buckets,task.start-0.0001,task.finish-0.0001);
      roles.forEach(function(role){
        var fte=task.rates[role]||0;
        if(!fte)return;
        var values=roleBuckets[role];
        for(var i=span[0];i<span[1];i++)values[i]+=fte;
      });
    });
    buckets.forEach(function(b,i){b.VWM=roles.reduce(function(sum,role){return sum+roleBuckets[role][i];},0);});
    return {buckets:buckets,t0:input.t0,t1:input.t1,vwmRoles:roleBuckets};
  }
  return {range:range,weekly:weekly};
})();
