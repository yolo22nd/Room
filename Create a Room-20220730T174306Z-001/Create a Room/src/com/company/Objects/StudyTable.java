package com.company.Objects;

import com.company.Base;
import com.company.You;

public class StudyTable extends Base {
    public String object = " Table  ";
    public static String name = "a Study Table";
    public static int position=-10;

    public void sitOnTable() {
        if (You.sitting) {
            System.out.println("you are already sitting");
        }else {
            System.out.println("you sat on the table");
            System.out.println("insane much ??");
        }
    }

    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionTable=position;
        setHere(object,position);
        super.printMap(position);
    }
}
