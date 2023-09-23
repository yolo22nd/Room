package com.company.Objects;

import com.company.Base;
import com.company.You;

public class DiningTable extends Base {
    public String object = " Dining ";
    public static String name = "a Dining Table";
    public static int position=-10;

    public void sitOnDine() {
        if (You.sitting) {
            System.out.println("you are already sitting");
        }else {
            System.out.println("you sat on the dining table");
        }
    }

    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionDine=position;
        setHere(object,position);
        super.printMap(position);
    }
}
